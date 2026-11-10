# Vivacom Workspace — Requirements (deep dive)

Internal tool for Vivacom. One login per employee. The login itself is the attendance clock.
Target scale: 20–150 staff, a handful of team leads, 1–3 HR, 1–3 management. Single tenant.

## 1. Roles

| Role | Who | Sees / does |
|---|---|---|
| `employee` | Everyone | Own day (clock, breaks, tasks), own tasks and projects they're on, own leave and balances, own payslips (full-time) or monthly claims (contractor), chat. |
| `team_lead` | Leads one or more teams | Everything an employee has, plus: live status + history of their team, regularization approvals, first-tier leave approval, project/board management for projects they lead, task assignment, verify contractor claims for their team. |
| `hr` | HR staff | Everything, scoped to people operations: directory, onboarding, salary structures, attendance policy, leave policy and second-tier approval, payroll runs, payslips, reports. No client invoicing. |
| `management` | Owners / finance | Everything. Approves payroll runs, approves and pays invoices and claims, manages clients, sees company dashboard. |

A user has exactly one role. Team lead is a role, and the scope comes from `teams.lead_id`.
Permission checks are **role + scope** (e.g. a team lead approves leave only for members of their teams).

## 2. Attendance (core loop)

Login and logout drive the clock. No separate "punch" app.

### State machine (per employee, per calendar day)

```
not_started --login--> working --logout(break, category)--> on_break --login--> working
working --logout(end_day)--> ended
ended --login--> working        (overtime session; flagged)
working --idle N min (no heartbeat)--> on_break(category=idle)  (auto; server-side)
```

- A day is made of **segments**: `work` and `break`. Every transition closes one segment and opens the next. Counters (work seconds, break seconds) are derived, never stored as truth.
- Logout always asks: **Take a break** (pick category: short / tea / lunch / official step-out) or **End my day**. There is no silent sign-out; signing out *is* a break ("Signed out").
- Breaks optionally carry a note. Lunch is capped by policy (e.g. 60 min); over-cap minutes show as a warning, not an error.
- **Late**: first login after `shift_start + grace`. Late minutes recorded. Employee can request **regularization** (reason); team lead approves/rejects.
- **Idle**: client sends heartbeat each minute while the tab is open. No heartbeat for `idle_timeout` (default 10 min) → server opens an `idle` break at the last heartbeat time. Next activity/login closes it.
- **Task time**: while `working`, the employee may select a current task. Work seconds accrue to that task as a `task_time_entry`. Changing task splits the entry. No task selected → unallocated time.
- Timezone: company TZ (Asia/Dhaka). Day boundary at local midnight. Night shifts out of scope v1.

### Team view (team lead, HR, management)
- Live grid: each member → status (working / on break: category + since / ended / not started), today's work time, current task, late flag.
- History: pick a date range → per member per day: in, out, work, break, late, regularized. Export CSV.
- Regularization queue.

### Policies (HR)
Shift start/end, grace minutes, standard hours per day (8), idle timeout, lunch cap, late penalty rule (e.g. 3 lates = 1 unpaid half-day), weekend days, public holidays.

## 3. Leave

- Leave types with yearly quota, paid/unpaid, carry-forward flag, half-day allowed flag.
- Balances per employee per type per year: entitled, used, pending, available.
- Request: type, dates (half-day option), reason, attachment (sick note). Overlap with team members shown to the lead at approval time.
- Approval flow: `pending_lead → pending_hr → approved`; either can reject with reason; employee can cancel while pending or before start date.
- Approved leave shows on team calendar and on attendance history as `on_leave`.
- Unpaid leave feeds payroll deductions.

## 4. People (HR)

- Directory: search, filter by team/department/type/status.
- Profile tabs: Overview (contact, team, lead, joining, type, status), Employment (designation history), Compensation (salary structure versions with effective dates; HR + management only), Bank, Documents, Assets, Attendance summary, Leave balances.
- Onboarding: create user + employee in one flow (4 steps: identity → employment → compensation → access). Sends invite. Checklist (laptop, accounts, policy ack) tracked per hire.
- Status: active / probation / on_leave / resigned / terminated with effective dates. Offboarding sets exit date and disables login.

## 5. Payroll (full-time staff)

- Monthly **payroll run**. One per month. Status: `draft → review → approved → paid`. Approved runs are locked.
- Items per employee computed from: salary structure effective that month, attendance (unpaid leave days, late penalties per policy, overtime hours × hourly rate if enabled), adjustments (bonus / deduction with label and note), tax, PF.
- HR drafts and reviews; management approves; HR marks paid with disbursement date and bank reference. Payslip PDF per item; employee sees own payslips.
- Recompute allowed only in `draft`/`review`. Changing a salary structure never mutates past runs.

## 6. Invoicing

Two distinct documents, kept separate in UI:

**Client invoices** (management): to a `client` for a `project` or retainer. Line items optional (retainer = one line). Fields: number (`VIV-2026-0042`), issue/due date, currency, lines, tax %, discount, notes, status `draft → sent → paid | overdue | void`. Record payments (partial allowed). PDF.

**Contractor claims** (contractors only, replaces payroll for `employment_type = contractor`): monthly claim generated from tracked hours × rate (or fixed monthly). Flow: `draft → submitted → verified (lead) → approved (management) → paid`. Lead sees hours vs tracked time side by side. Full-time staff never see this module.

## 7. Projects & tasks

- `client` → `project` (key `PULSE`, name, status, lead, members, billing type). Internal projects have no client.
- Board per project with columns (default: Backlog, To do, In progress, Review, Done); columns editable per project.
- Task: `PULSE-142`, title, description (markdown), status, priority, assignee, reporter, labels, estimate, due date, subtasks, attachments (paste screenshot), comments, time tracked (from attendance), activity log.
- Views: board, list (filter/sort/group), "My tasks" across projects.
- Task references `PULSE-142` auto-link everywhere (chat, comments, descriptions).

## 8. Chat

- Conversations: DM, team channel (auto per team), project channel (auto per project), ad-hoc group.
- Message: text (light markdown), attachments, task references rendered as cards, @mentions.
- Unread counts, mark read. Real-time via websockets.
- Not a Slack clone: no threads, no reactions in v1.

## 9. Cross-cutting

- **Home** is role-specific: employee sees clock + my tasks + leave balance + unread; lead adds team live status + approvals; HR adds hiring/leave/payroll pending; management adds company stats + invoices due.
- **Inbox**: approvals and mentions in one list (leave, regularization, claims, payroll, invoice).
- Audit log on every approval and money-related change.
- Light and dark theme, keyboard shortcuts for common actions, Ctrl/Cmd-K command palette.
- Mobile: clock, tasks, leave, chat must work on a phone. Admin tables can be desktop-first.
