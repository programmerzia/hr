# 07 — HR & Payroll upgrade plan

Status: implemented and deployed 2026-11-12 (waves P0–P3, commits 48fece4…5fd1872). Open items are listed in §8. Builds on the deployed Laravel + Inertia app (`06-backend-plan.md`). Scope is the
HR / attendance / leave / payroll chain only. Billing, Work and Inbox are untouched except where they consume
shared props.

## 1. What exists today (audit of `app/Domain/{Attendance,Leave,Payroll}`)

| Area | Present | Gap |
|---|---|---|
| Late | `StartWork` stores `late_minutes` when login > shift start + grace (15 min). Regularisation clears it. | No half-day rule for very late login. No early-leave rule. Policy JSON editable only in DB. |
| Late → money | `PayrollCalculator`: every 3 unexcused lates = 0.5 day of gross. | Rule is fixed to "N lates = X days". No cap, no monthly reset flag shown to the employee, no visibility of "2 of 3" on My day. |
| Absence | `attendance_days` has `absent/holiday/on_leave` statuses but **nothing writes them**. A working day with no record is silently ignored by payroll. | **Unapproved absence costs nothing.** Days are never closed at midnight either (a forgotten "working" day keeps counting). |
| Joiners / leavers | Eligible = joined by month end, not exited before month start. | **No proration.** Someone joining on the 25th gets a full month. Leaver likewise. |
| Salary change mid-month | `salaryOn(month end)` | Whole month priced at the new structure. |
| Unpaid leave | Approved unpaid leave days × daily rate deducted. | Correct. Half days handled. |
| Paid leave | Counted as worked time. | Correct. |
| Leave balances | Quota rows per year; pending/used maintained. | No carry-forward at year end, no proration for joiners, no encashment, no year rollover job. |
| Overtime | Minutes computed; pay **disabled** (flag false). | No policy (who is eligible, rate, approval, cap). |
| Statutory | Employee PF % of basic; `tax_monthly` typed in by HR. | No employer PF side, no PF ledger, no tax year view, no gratuity/festival bonus. |
| Payroll items | Store gross/net/deductions totals. | **No snapshot of components** (basic, house rent, medical, conveyance). Payslip re-reads the salary structure at view time. |
| Workflow | draft → review → approved → paid, `locked_at`, HR adjustments, management approval, run log. | Adjustments after lock are not blocked server-side (verify). No bank advice export, no payslip PDF (print view only), no employee-facing payslip email/notification, no per-item "hold". |
| Reports | Run detail with per-item table and charts. | No month-over-month, department cost, YTD per employee, or CSV export. |
| HR settings | `Settings` page is a placeholder. | Attendance policy, leave types, holidays, pay-day cannot be edited in the UI. |

The last three rows in the first block are the ones a real HR team will hit in month one. They go first.

## 2. Target rules (all editable by HR in Settings, versioned by effective date)

Owner decisions 2026-11-12: salary is a **monthly** amount; the daily rate exists only to price deductions. Every
deduction is a switch in Settings, nothing is deducted because of a hard-coded default. **PF is off by default.**
Time rules live in `attendance_policies`; money rules live in a new `payroll_policies` table (singleton, versioned):

```
payroll_policies  id, effective_from,
                  daily_rate_basis enum(working_days, calendar_days, fixed_30, fixed_26) default working_days,
                  lop_enabled bool default true,                 -- absent / half-day / unpaid-leave deduction
                  late_penalty_enabled bool default false, lates_per_penalty 3, penalty_days 0.5, max_penalty_days_per_month 3,
                  pf_enabled bool default false, pf_employee_percent 0, pf_employer_percent 0,  -- structure may override %
                  tax_enabled bool default true,                 -- deduct structure.tax_monthly (HR-entered TDS)
                  overtime_enabled bool default false, overtime_multiplier 1.5, overtime_requires_approval true,
                  overtime_min_block_minutes 30, overtime_daily_cap_minutes 240
```
`PayrollCalculator` receives the policy and skips any block whose switch is off. The run snapshot stores `payroll_policy_id`.
`attendance_policies.late_penalty_rule` is migrated into `payroll_policies` and dropped.


### Attendance policy (`attendance_policies` becomes versioned: add `effective_from`, keep `current()` = latest ≤ today)
- Shift 10:00–19:00, standard 480 min, grace 15 min, weekend Fri/Sat, holidays table.
- **Late**: login > shift start + grace → late. `late_minutes` stored (exists).
- **Half-day on late**: login later than `half_day_after_minutes` (default 120) → day counts as half (`day_fraction = 0.5`) unless regularised.
- **Early leave**: end-day before `shift_end − early_leave_grace` (default 30) → `early_minutes` stored; counts toward the same late-units counter (configurable: `early_counts_as_late` default true).
- **Minimum hours**: `work_seconds` < `half_day_min_minutes` (default 240) → half day; < `absent_below_minutes` (default 60) → absent, unless on approved leave/holiday.
- **Late penalty**: `lates_per_penalty` 3, `penalty_days` 0.5, `max_penalty_days_per_month` 3 (new cap), reset monthly.
- **Day close job** (`attendance:close-day`, 00:10 daily): for yesterday, every active full-time employee: no row → create `absent` (or `holiday`/`on_leave`/`weekend` when applicable); row still `working`/`on_break` → close open segment at `shift_end` (or last heartbeat if earlier), mark `auto_closed = true`, notify the employee and lead to regularise. Writes `day_fraction` (1, 0.5, 0) and `absence_kind` (`none|unapproved|unpaid_leave|paid_leave|holiday|weekend`).

### Loss of pay (LOP)
- `lop_days = Σ(1 − day_fraction)` over working dates in the month where the day is not covered by paid leave or holiday, **plus** approved unpaid leave days (already there), **plus** late penalty days (capped).
- Daily rate = `gross / divisor` where divisor follows `daily_rate_basis` (working days of the month by default; 30, 26 or calendar days selectable). Used only to price LOP, late penalty and encashment; the monthly gross itself is never rebuilt from days.
- An unapproved absence can be converted after the fact by HR: mark as paid leave (deducts balance), unpaid leave, or "excused" (no deduction) with a note. This is the `regularization_requests` flow extended with a `resolution` enum.

### Proration
- Working days for an employee = working dates in month ∩ [joined_on, exited_on]. Days outside the window are neither worked nor LOP; gross is scaled by `eligible_days / working_days`.
- Salary change mid-month: split the month at each `effective_from`, price each slice with its structure, sum. Items store the slice breakdown.

### Overtime (policy, off by default)
- `overtime_enabled`, `overtime_eligible_types` (default `[]`; options full_time), `overtime_min_block_minutes` 30, `overtime_multiplier` 1.5, `overtime_requires_approval` true, `overtime_daily_cap_minutes` 240.
- Overtime = work beyond `standard_minutes` on working days and all work on weekends/holidays, floored to blocks. When approval required, lead/HR approves per day from Team history; only approved minutes are paid.

### Leave
- Year rollover job (`leave:rollover`, Jan 1): per employee × type → new balance row; carry-forward min(unused, `carry_forward_cap`) when type allows (default cap 7 for Annual); others reset.
- Joiner proration: `entitled = quota × remaining_months / 12`, rounded to 0.5, applied at onboarding and when a type is created.
- Probation rule: `allowed_on_probation` per type (Sick yes, Annual no by default).
- Encashment at exit: `encashable` per type; final settlement run item adds `leave_encashment = unused × daily_rate`.

### Statutory and fixed items
- PF: **off unless `pf_enabled`**. Employee % and employer % from the policy, overridable per salary structure. Both snapshot on the item. New `pf_ledger` table: one row per item (employee, employer, cumulative) so a PF statement can be printed.
- Tax: keep `tax_monthly` per structure (HR enters the TDS figure), add a per-employee **tax year** view (Jul–Jun) that sums gross and TDS for the challan. Automatic slab calculation is out of scope until the company confirms it wants the app to be the source of truth.
- Festival bonus: run-level `bonus_run` flag with `bonus_percent_of_basic`; HR creates a separate run (`kind = festival`) in the same month. One `payroll_runs` row per (year, month, kind).
- Final settlement: `kind = settlement` run for one employee on exit: prorated salary, encashment, pending adjustments, asset deductions.

### Payroll items (immutable snapshot)
- Add columns: `components` JSON (basic, house_rent, medical, conveyance, other allowances, per slice), `day_fraction_total`, `lop_days`, `late_penalty_days`, `absent_days`, `paid_leave_days`, `holiday_days`, `eligible_days`, `pf_employer`, `leave_encashment`, `hold` boolean + `hold_reason`.
- On `approve`, snapshot is frozen: structure id, policy id, every fact. `reprice`/`recompute`/adjustments return 422 when `locked_at` is set (add the guard and a test).
- Payslip renders from the snapshot only. PDF via `spatie/laravel-pdf` (Browsershot needs Chrome on vivadev — check; fallback `barryvdh/laravel-dompdf`, which is pure PHP and fine for a one-page payslip). Stored at `storage/app/payslips/{run}/{code}.pdf`, download through `viewPay` policy (exists).
- Bank advice CSV on paid/approved runs: bank, branch, account name, account no, routing, net. Held items excluded.

### Workflow additions
- Per-item **hold** (HR, before approve): excluded from totals and bank file, carried to next run as a note.
- **Variance check** on submit: items whose net differs > 20 % from last paid month are flagged; HR must acknowledge each flag before management can approve.
- Employee notification on `paid`: database notification + payslip link (Inbox exists).
- Reopen: management can `reopen` an approved (not paid) run back to review with a reason; log entry.

### Reports (HR, management)
- Payroll summary by month: headcount, gross, deductions by type, net, employer cost (gross + employer PF). 12-month chart.
- Department cost per month.
- Employee YTD (tax year) statement.
- Attendance month sheet: employee × day grid (P / L / A / H / W / ½), exportable CSV. Lead sees own team.
- All exports CSV; the payslip is the only PDF.

## 3. Data model changes (one migration per wave, all MySQL + sqlite safe)

```
attendance_policies      + effective_from date, half_day_after_minutes, early_leave_grace_minutes, early_counts_as_late,
                           half_day_min_minutes, absent_below_minutes, max_penalty_days_per_month, overtime_* (6 cols)
attendance_days          + day_fraction decimal(3,2) default 1, absence_kind enum, early_minutes int, auto_closed bool,
                           approved_overtime_minutes int, closed_at timestamp
regularization_requests  + kind enum(late, early, absent, auto_closed, overtime), resolution enum(excused, paid_leave, unpaid_leave, keep)
                           leave_type_id nullable
leave_types              + carry_forward_cap decimal, allowed_on_probation bool, encashable bool
leave_balances           + carried_in decimal, encashed decimal
salary_structures        + pf_employer_percent decimal(5,2), other_allowances json, note
payroll_runs             + kind enum(regular, festival, settlement) default regular, employee_id nullable (settlement),
                           bonus_percent_of_basic, reopened_at, reopened_by, reopen_reason; unique → (year, month, kind, employee_id)
payroll_items            + components json, eligible_days, absent_days, paid_leave_days, holiday_days, lop_days, late_penalty_days,
                           day_fraction_total, pf_employer, leave_encashment, hold bool, hold_reason, variance_flag bool,
                           variance_ack_by, policy_id, snapshot_at
pf_ledger                 new: id, item_id, employee_id, year, month, employee_amount, employer_amount, cumulative_employee, cumulative_employer
overtime_approvals        folded into regularization_requests (kind = overtime) — no new table
```

Existing rows: backfill `day_fraction = 1`, `absence_kind = none`, `components` from the linked structure for paid runs (one-off command `payroll:backfill-snapshots`, run once on deploy).

## 4. Code shape

- `App\Domain\Attendance\Services\DayGrader` — pure: (policy, day totals, first_in, last_out, leave weight, holiday?) → `{day_fraction, absence_kind, late_minutes, early_minutes, overtime_minutes}`. Unit tested table-driven.
- `App\Domain\Attendance\Actions\CloseDay` — the 00:10 job body; idempotent per (employee, date).
- `App\Domain\Payroll\Services\PayrollFacts` replaces `PayrollPeriod::facts`: returns the full fact set per employee per slice (eligible dates, graded days, leave, late units, overtime approved).
- `App\Domain\Payroll\Services\PayrollCalculator` — stays pure; new signature takes slices + facts + policy; returns the full item snapshot. Keep the old `calc()` as an adapter until RunDetail is migrated, then delete.
- `App\Domain\Payroll\Services\PayslipPdf`, `BankAdvice`, `Reports\{MonthlySummary, DepartmentCost, YtdStatement, AttendanceSheet}`.
- `App\Domain\Leave\Actions\RolloverYear`, `ProrateEntitlement`, `EncashOnExit`.
- Settings: `App\Http\Controllers\Settings\{PolicyController, LeaveTypeController, HolidayController}`; abilities `manage_policy` (hr, management).
- Frontend pages (Inertia, existing design system): `Settings/{PolicyPage, LeaveTypesPage, HolidaysPage}`, `Payroll/ReportsPage`, `Payroll/RunDetailPage` (hold, flags, bank file, reopen, slices), `Payroll/PayslipPage` (snapshot, PDF button), `Attendance/MonthSheetPage`, `Attendance/MyDayPage` (late counter "2 of 3", day grade), `Attendance/RegularizationsPage` (kinds + resolutions), `People/ProfilePage` (PF employer %, other allowances, tax year, PF statement), `People/OffboardDialog` (exit date → settlement run).

## 5. Waves and model split

Rule: Opus for anything that computes money or changes state machines; Sonnet for controllers, pages, settings, reports; Haiku for QA scripts and test data. Each agent gets: this doc, the files it owns, and must finish with `php artisan test`, `pnpm typecheck && pnpm lint && pnpm build`, `pnpm smoke` green. Agents use private sqlite test DBs (`DB_CONNECTION=sqlite DB_DATABASE=/tmp/claude-1000/<agent>.sqlite DB_URL=`).

**Wave P0 — correctness foundation (Opus ×2, parallel, ~1 day)**
1. *Attendance grading*: migration (policy + days + regularization columns), `DayGrader`, `CloseDay` + schedule, `StartWork`/`EndDay` write early/half-day, regularisation kinds + resolutions, My day late counter, tests (grader table of 15 cases, close-day idempotency, timezone edge at 23:59 Dhaka).
2. *Payroll facts + snapshot*: migration (items/runs/structures/pf_ledger), `PayrollFacts` with proration and salary slices, new `PayrollCalculator`, snapshot on approve, lock guard on every mutating action, `payroll:backfill-snapshots`, tests (joiner on 25th, leaver on 10th, raise on 16th, LOP cap, PF both sides, locked run rejects adjustment).
   Dependency: P0.2 reads `day_fraction`/`absence_kind` — agree the column names above before starting; both can run in parallel against the agreed schema.

**Wave P1 — HR controls (Sonnet ×3, parallel)**
3. Settings: policy (versioned), leave types, holidays; `manage_policy` ability; nav entry; validation; tests.
4. Payroll run UX: hold, variance flags + acknowledge, reopen, bank advice CSV, payslip PDF (dompdf), paid notification, RunDetail/Payslip pages read snapshot.
5. Leave lifecycle: rollover job, joiner proration at onboarding, probation rule, encashment, balance page shows carried-in.

**Wave P2 — reports and extra runs (Sonnet ×2)**
6. Reports: monthly summary, department cost, YTD statement, attendance month sheet (+ CSV). Charts use existing `charts.ts` helpers.
7. Festival bonus run and final settlement run (kind column, one-employee run, offboard dialog). Overtime approval flow (lead approves from Team history) — ships with `overtime_enabled = false`.

**Wave P3 — QA and deploy (Haiku QA → Sonnet fixes → me)**
8. Haiku: extend `scripts/qa-flows.mjs` with G (late → half-day → regularise → payroll reflects), H (joiner proration), I (hold + bank file), J (settings change takes effect next day only); extend DemoSeeder with an absent day, a mid-month raise, a joiner on the 25th. Sonnet fixes whatever fails. Deploy with `scripts/deploy.sh`, run `payroll:backfill-snapshots`, verify cron picks up `attendance:close-day` and `leave:rollover`.

Estimated agent cost: P0 2 Opus sessions, P1–P2 5 Sonnet sessions, P3 1 Haiku + 1 Sonnet. Roughly a third of the backend build.

## 6. Decisions needed from the owner (defaults in bold; proceed with defaults if no answer)

1. Daily rate base: working days of the month (default, switchable in Settings). Decided.
2. Late penalty: **3 lates = half day, cap 3 days/month**; or per-minute deduction instead.
3. Half-day threshold: **login later than 2 h after shift start**, **fewer than 4 h worked**.
4. Early leave counts as a late unit: **yes**.
5. Overtime: **off**; if on, 1.5× hourly, approval required.
6. PF: off by default, HR switches on and sets both percents. Decided.
7. Annual leave carry-forward cap: **7 days**; sick/casual reset.
8. Interns: **excluded from payroll** (stipend tracked as a fixed-amount structure later if wanted).
9. Tax: **HR enters monthly TDS**; no automatic slab.
10. PDF engine: **dompdf** (no Chrome on server).

## 7. Out of scope here
Chat, Reverb realtime, bank API integration, biometric devices, multi-company, multi-currency.

## 8. Shipped state (2026-11-12) and open items

Shipped: DayGrader + nightly `attendance:close-day`, regularisation kinds/resolutions, PayrollFacts (proration, slices, open-day rule),
switch-driven PayrollCalculator, snapshots, hold/reopen/variance ack, bank advice CSV, PF ledger, dompdf payslips, paid notifications,
Settings (versioned attendance + payroll policy, leave types, holidays), leave proration/rollover/probation/encashment, reports
(summary, department cost, tax-year statement, attendance sheet), festival bonus and final settlement runs, overtime approval.
Tests 235, QA flows A–K 60/60, smoke 80/80.

Open: tax slab automation (TDS stays HR-entered); gratuity; Bengali PDF font; department cost month range; HR nav entry for Claims;
Reverb realtime; chat. Operational: HR must create the first real payroll policy version in Settings → Payroll (defaults ship with
PF and late penalty OFF, LOP ON); run `attendance:close-day` manually for any backlog dates if the cron was down.
