# 09 — Attendance & leave hardening (2026-11-22)

Source: e2e walk of every leave and attendance screen against the local DB (8 seeded users, all roles), plus a code read of
`app/Domain/Attendance`, `app/Domain/Leave`, `app/Domain/Payroll/Services/PayrollFacts.php`. Every item below was observed
live or traced in code; reports are kept with the session, the evidence summary is inline.

Owner decisions (2026-11-22):
- **Idle = no input.** No keyboard/mouse/scroll/touch in the app for `idle_timeout_minutes` opens an idle break from the last
  activity; the next input resumes work.
- **Backdated leave is allowed until payroll locks.** A request may cover past dates unless a payroll run for that month is
  no longer editable (`PayrollRun::isEditable()` false). Approving or cancelling re-grades the attendance days it covers.

## A. Attendance — day lifecycle (one owner: attendance agent)

| # | Problem (evidence) | Required behaviour |
|---|---|---|
| A1 | Sign-in after the browser was closed / session lost: `LoginController::store` calls `StartWork` (returns `already_working`) and then overwrites `last_seen_at`. The gap is credited as work (observed: one open work segment 20:02 → NULL across an 11-min gap). | Before `StartWork`, run the same offline reconciliation the heartbeat does. Extract `Heartbeat::reconcileOffline` into a shared service (e.g. `Services\Presence::reconcile(User, now)`), call it from Heartbeat and login. |
| A2 | Stale days: a day left `working`/`on_break` (forgot to end day, no cron) stays open forever. `TeamHistoryController` totals open segments up to *now* → "Break 221h". 5 segments open since 13 Nov in local data. | (a) Self-heal without cron: on login and on heartbeat, any of the employee's days **before today** still `working`/`on_break` is closed via `CloseDay` for that date. (b) History/CSV/My day never extend a past day's open segment beyond that day's close time (use the stored rollup or the same close-time rule). |
| A3 | `CloseDay::closeAt` uses `users.last_seen_at`, which belongs to today, for a past date (observed: 13 Nov break closed at 19:00 using a 22 Nov heartbeat). | Track activity per day: add `attendance_days.last_activity_at` (nullable datetime), set by heartbeat / start / break / resume / end. `closeAt` = min(shift end when the open segment started before it, `last_activity_at` of that day, midnight), never before the open segment's start. Fall back to the open segment's `started_at` when there's no activity record. |
| A4 | Contractors are excluded from `CloseDay`, so their running days never close (Nusrat's 13 Nov row still `on_break`). | Close running days for every employee who has a row (contractors included). Contractors still get no absent/holiday rows created and no absence notification. |
| A5 | Weekend/holiday sign-in is graded late/half-day at login (Friday rows showed `half_day`, late 292 min) and `CloseDay` sends "closed automatically" notifications for weekend days. | `StartWork` sets `late_minutes`/half-day only on a working day (not weekend, not holiday, not full-day leave; first-half leave → no late). Auto-close notification only on working days. |
| A6 | Idle is detected only when the tab is closed (heartbeat fires every 60 s regardless of input). | Owner decision above. Client tracks last input time (keydown, pointerdown, mousemove throttled, wheel, scroll, touchstart, visibility→visible) and sends `last_activity_at` (ISO) with each heartbeat. Server: if working and `now - last_activity_at > idle_timeout`, close work at `last_activity_at` and open an idle break from it (category `idle`, source `idle`). Next heartbeat with fresh activity closes the idle break and resumes work (existing path). Clamp client time to [open segment start, now] — never trust it beyond that. Keep `SweepIdle` for closed tabs. |
| A7 | `Heartbeat::reconcileOffline` relabels an idle-sweep break as "offline / App closed" on return. | Keep the category `idle` when the break was opened by idle detection; only a gap with no heartbeat at all becomes `offline`. |
| A8 | Midnight: overtime running past 00:00 is cut at midnight by close-day and later heartbeats hit a missing row. | After a past day is closed by self-heal, if the user is still active the heartbeat/login opens today's row (StartWork path) so time continues on the new date. |

## B. Attendance — regularization, overtime, settings

| # | Problem | Required behaviour |
|---|---|---|
| B1 | No notification on regularization decision; none to the lead on a new request. | Notify requester on approve/reject (with note); notify deciders (lead; HR when no lead) on a new request. Use `AttendanceNotification`. |
| B2 | Deciding an already-decided request returns a bare 403 (policy requires pending). | Policy checks scope only; action returns false → flash "This request was already decided." |
| B3 | Regularise is offered on today's running day, and on days whose request was rejected (re-request is fine, but say so). | Only past days, or today once ended. Show the last decision note next to the button when one exists. |
| B4 | `OvertimeController::revoke` writes an audit row even when approval isn't required. | Same guard as approve. |
| B5 | `StartBreak` always stores `source='logout'`. | Pass the source: `logout` from sign-out, `manual` from My day. |
| B6 | Attendance policy version effective **today** cannot be edited/removed, and a second same-date version is refused → no way to correct today's rule. | `editable()` = `effective_from >= today`. Editing today's version re-grades today's already-ended days. |

## C. Leave

| # | Problem | Required behaviour |
|---|---|---|
| C1 | **Approved leave never re-grades attendance.** Leave approved after the day was closed leaves `absence_kind=unapproved`, `day_fraction=0`; `PayrollFacts` reads those → LOP charged for approved leave. Same for cancelling an approved leave, adding/removing a holiday after the fact. | New `App\Domain\Attendance\Actions\RegradeDays::__invoke(string $employeeId, string $from, string $to): int` (attendance agent). For each date in range up to yesterday: a closed or ended row is re-graded with `Grading::apply` and saved; a missing past row is created by `CloseDay` logic; today/future untouched. Callers: `ApproveAsHr`, `Cancel` (approved only), `DecideRegularization` paid-leave booking, holiday store/bulk/destroy (all employees, that date). |
| C2 | Backdating has no rule. | Owner decision: refuse when any covered date falls in a month whose payroll run exists and `! isEditable()` → "Payroll for {Month} is already approved; ask HR to adjust it there." Same check on approve and cancel. |
| C3 | Cross-year request (29 Dec → 4 Jan) charged wholly to the start year; balance check uses the start year only. | Split working days by calendar year (`LeaveDays` per year slice). Availability is checked per year; `BalanceService::adjust` applies each year's share to that year's row. |
| C4 | `BalanceService::adjust` creates a missing row with the raw `annual_quota` (not pro-rated, contractors not 0), unlike `forEmployee`/`ProvisionBalances`. | Create through `ProvisionBalances` semantics (pro-rated, contractor 0). |
| C5 | Changing a type's quota in Settings doesn't reach stored balances; the card then shows "of 8 …, prorated" while the quota is 9. | On quota change, update current-year (and later) rows whose `entitled` equals the entitlement under the old quota, to the entitlement under the new quota. Rows that were hand-edited are left alone. Fix the "prorated" label to compare against the employee's computed entitlement, not the raw quota. |
| C6 | HR's own leave notifies nobody when they are the only HR user (`toNextDecider` excludes the requester, so the management fallback never runs). | If no other HR user exists, notify management. Generally: next deciders = users who can decide minus the requester. |
| C7 | HR/management approving a `pending_lead` request records the HR user as the *lead* stage decider and sends a spurious "waiting for HR" notification to themselves. | Record a single `hr` stage approval with note "approved on behalf of lead"; no intermediate notification. |
| C8 | Attachment field is accepted and silently discarded (`attachment_path` always NULL). | Real upload: optional file (pdf/jpg/png, ≤ 5 MB) on the request dialog, stored on the private disk, downloadable by the requester and deciders. If the `Attachment` model fits, use it. |
| C9 | 2027 holidays don't exist, so future-year requests count public holidays as working days. | Not code: HR adds them in Settings → Holidays. The request dialog shows a note when the range is in a year with zero holidays configured. |

## D. UI

- D1 My day at 390 px: segments table overflows the page (+235 px). Wrap in the same scroll container the team tables use.
- D2 Approvals at 390 px: Approve/Reject are off-screen in the table. On narrow screens render each request as a card with the actions visible.
- D3 Reject dialog: disable Reject until a note is typed (same as request dialog).
- D4 Request dialog: when To < From say "End date is before the start date" in the preview.
- D5 Regularize dialog: the "Add a short reason." hint is unreachable; show it as helper text.
- D6 Team history: say "From is after To" instead of an empty table for reversed ranges.

## E. Ops

- E1 The local machine has no `schedule:run` cron, so sweep/close-day never ran here. **Production must be checked**: `* * * * * cd /var/www/html/hr && php artisan schedule:run >> /dev/null 2>&1` for the web user. A2(a) removes the hard dependency for open days, but absent rows for people who never signed in still need the nightly close.
- E2 Seed data has rows that the current grader would never produce (absent with fraction 1.00; `is_regularized` without a request; Imran's 2026 balances not pro-rated). Fix `DemoSeeder` to go through the real actions.

## Tests

Every item gets a Pest test that fails before the fix. Run with `PAO_DISABLE=1 php artisan test`. Whole suite must stay green.
