# Architecture

## Decision: Laravel 13 + Inertia (React 19, TypeScript)

Chosen over a separate SPA + REST/GraphQL API.

Why, for this product:
- Internal tool, one team builds both halves. Inertia removes the API layer, token auth, CORS, API versioning, duplicate validation and duplicate type definitions.
- Authorization lives in Laravel policies and is passed to pages as props. The role-aware sidebar is computed server-side (`HandleInertiaRequests` shares `auth.user`, `auth.abilities`, `nav`). No permission logic duplicated in the client.
- Attendance correctness depends on server time and server-side idle detection. With Inertia every transition is a POST to a controller; the client never owns the clock.
- Realtime (team live status, chat, notifications) via **Laravel Reverb** + Echo. Works identically with Inertia.
- Payslip/invoice PDFs via server rendering (Blade + browsershot or dompdf).
- Deploy is one artifact: `php artisan` app + built assets. No second host, no API gateway.

When to revisit: a native mobile app or a public client portal. Then expose a small REST API next to Inertia; the domain layer (actions/services) is already separate from controllers so this is additive.

## Backend shape (Laravel 13)

```
app/
  Domain/
    Attendance/   Actions (StartWork, StartBreak, EndDay, MarkIdle, Regularize), Services (DayCalculator), Policies
    Leave/        Actions (Submit, ApproveAsLead, ApproveAsHr, Reject, Cancel), BalanceService
    People/       Actions (OnboardEmployee, ChangeSalaryStructure, Offboard)
    Payroll/      Actions (DraftRun, Recompute, ApproveRun, MarkPaid), PayrollCalculator, PayslipRenderer
    Billing/      Clients, Invoices, Claims
    Work/         Projects, Boards, Tasks, TimeEntries
    Chat/
  Http/Controllers/<Module>/...    thin: validate → action → redirect/Inertia::render
  Http/Middleware/HandleInertiaRequests.php   shares auth, abilities, nav, flash, unread counts
  Events/ Listeners/ Jobs/ (idle sweeper every minute, payroll recompute, invoice overdue)
database/migrations, factories, seeders (demo seed mirrors the mock data)
routes/web.php grouped by module with policy-backed middleware
```

Packages: `inertiajs/inertia-laravel`, `tightenco/ziggy`, `spatie/laravel-permission` (roles only; abilities via policies), `spatie/laravel-activitylog`, `laravel/reverb`, `barryvdh/laravel-dompdf` (or browsershot), `laravel/pennant` (feature flags), `laravel/pulse` (ops).

Auth: Laravel's session auth (Fortify or starter kit). **Login event → `StartWork` action**. Logout is a custom controller that takes `mode=break|end_day` and `break_category`. Heartbeat: `POST /heartbeat` every 60 s from the layout; scheduler job `attendance:sweep-idle` runs every minute.

## Data model (tables)

Identity / org
- `users` (id, name, email, password, role enum, employee_id FK, last_seen_at)
- `employees` (id, code `VIV-101`, user_id, department_id, team_id, designation, employment_type full_time|contractor|intern, status, joined_on, probation_until, exited_on, phone, nid, avatar_path)
- `departments`, `teams` (id, name, department_id, lead_employee_id), `team_members` (team_id, employee_id)
- `salary_structures` (employee_id, effective_from, basic, house_rent, medical, conveyance, pf_percent, tax_monthly, gross, hourly_rate) — append-only
- `bank_accounts` (employee_id, bank, account_name, account_no, routing_no, branch, is_primary)
- `employee_documents`, `employee_assets`, `onboarding_checklists`

Attendance
- `attendance_policies` (singleton row): shift_start, shift_end, grace_minutes, standard_minutes, idle_timeout_minutes, lunch_cap_minutes, late_penalty_rule json, weekend_days json
- `holidays` (date, name)
- `attendance_days` (employee_id, date, status not_started|working|on_break|ended|on_leave|holiday|absent, first_in_at, last_out_at, work_seconds, break_seconds, late_minutes, is_regularized) — seconds are a cached rollup of segments
- `time_segments` (attendance_day_id, type work|break, break_category short|tea|lunch|official|idle|signed_out, started_at, ended_at, note, source login|logout|idle_sweep|manual)
- `task_time_entries` (time_segment_id, task_id, employee_id, started_at, ended_at, seconds)
- `regularization_requests` (attendance_day_id, reason, status, decided_by, decided_at, note)

Leave
- `leave_types` (name, annual_quota, is_paid, carry_forward, allows_half_day)
- `leave_balances` (employee_id, leave_type_id, year, entitled, used, pending)
- `leave_requests` (employee_id, leave_type_id, starts_on, ends_on, half_day enum, days, reason, status pending_lead|pending_hr|approved|rejected|cancelled)
- `leave_approvals` (leave_request_id, stage lead|hr, decided_by, decision, note, decided_at)

Payroll
- `payroll_runs` (year, month, status draft|review|approved|paid, approved_by, approved_at, paid_at, locked_at)
- `payroll_items` (run_id, employee_id, salary_structure_id, standard_minutes, worked_minutes, overtime_minutes, unpaid_leave_days, late_count, gross, overtime_pay, unpaid_deduction, late_deduction, tax, pf, net, bank_account_id, payslip_path)
- `payroll_adjustments` (item_id, kind bonus|deduction, label, amount, note, created_by)

Billing
- `clients` (name, email, address, currency, default_rate)
- `invoices` (number, client_id, project_id, issued_on, due_on, currency, subtotal, tax_percent, discount, total, paid_total, status draft|sent|paid|overdue|void, notes, pdf_path)
- `invoice_lines` (invoice_id, description, qty, unit_price, amount)
- `invoice_payments` (invoice_id, paid_on, amount, method, reference)
- `contractor_claims` (employee_id, year, month, tracked_minutes, claimed_minutes, rate, fixed_amount, total, status draft|submitted|verified|approved|paid, verified_by, approved_by, paid_at, bank_account_id, pdf_path)

Work
- `projects` (key, name, client_id nullable, lead_employee_id, status active|paused|done, billing_type retainer|hourly|fixed|internal, rate)
- `project_members`, `board_columns` (project_id, name, position, is_done)
- `tasks` (project_id, number, title, body_md, column_id, priority, assignee_id, reporter_id, estimate_minutes, due_on, position)
- `labels`, `task_labels`, `subtasks`, `task_comments`, `attachments` (polymorphic), `task_activity` (via activitylog)

Chat
- `conversations` (type dm|team|project|group, name, team_id, project_id), `conversation_members` (last_read_message_id), `messages` (conversation_id, author_id, body, attachments json), task references parsed from body at render time (`[A-Z]{2,6}-\d+`)

Platform: `notifications` (Laravel), `activity_log`, `settings`.

## Frontend inside Laravel

`resources/js/` with the structure in `04-frontend-structure.md`. The mock in this repo is built so that `src/` moves to `resources/js/` with these swaps:
- `src/mock/*` store actions → `router.post(route('...'))`; page data arrives as Inertia props.
- `react-router` `<Link>` → `@inertiajs/react` `<Link>`; route table → Ziggy.
- Role-based nav config stays, but is fed from shared props rather than the mock session.
Everything else (layouts, UI kit, domain components, formatting helpers) is unchanged.

## Non-functional

- Server time is the source of truth. Client timers are display-only and resync on every response.
- All approvals and money changes are audited (activitylog) and show in a "History" panel on the record.
- Payroll runs and approved invoices are immutable; corrections are new adjustments / credit notes.
- Backups daily; payslip and invoice PDFs stored on disk/S3 with the record.
