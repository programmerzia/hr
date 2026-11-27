# 11. Go-live hardening (2026-11-27, for the 1 Dec 2026 start)

These changes come from an audit of attendance, payroll, the audit trail, reports and operations.

## Attendance
- **Presence (owner's rule, 27 Nov).** An open HR tab counts as work at any hour, whether or not the person types in it, because they may be working in another app with the browser minimised. There is no input check while "idle by input" is off.
  - Work beyond the standard 8 hours is overtime. DayGrader computes it, and payroll pays it only after a lead or HR approves it.
  - Work running at midnight carries on into the next day.
  - Trade-off: a tab left open overnight also counts until someone ends the day. That time shows as overtime waiting for approval, so the approver is the check.
- **Paused tabs.** Chrome and Edge freeze background tabs, and the gap is recorded as offline with the reason "Browser paused the HR tab".
  - My day lists these gaps with "Ask to count as work", a regularization of kind `paused`. Approving it turns the gap into work.
  - The heartbeat holds a Web Lock to discourage freezing, but this hasn't been checked in a browser yet.
  - **Ask staff to add hr.vivacombd.com to Chrome's "Always keep these sites active" and Edge's "Never put these sites to sleep".**
- **Early leave** is measured from the end of the last work segment. A short session (under 30 min) after a long gap (60 min or more) after shift end is ignored.
- **Breaks and start of day.**
  - A forgotten break shows "Still on break? Resume work" in the top bar once it runs past the lunch cap (or 60 min for other kinds) while the person is active.
  - A "Start your day?" prompt appears on the first input of a working day if nothing has started.
- **Server outage** is detected from the scheduler's per-minute `server_ticks` rows, not from "nobody sent a heartbeat".
- **Payroll lock.** Once a month's regular run is approved, the following are refused or skipped in that month: regularisation, overtime decisions, regrading, closing days, and adding or removing holidays.

## Payroll
- **Before submitting.**
  - Submit recomputes the run.
  - Submitting before the month ends needs "Pay before month end" and a reason.
  - Submit is refused while any payable item has a negative net.
- **Approving.**
  - Approve re-prices every item and refuses if any net changed since the review.
  - Maker-checker: the preparer, the submitter, or anyone who edited the run since it was submitted cannot approve it.
  - The setting "Allow one person to prepare and approve" lifts this rule. Self-approvals are then logged and flagged as self-approved.
- **Paying.** Marking a run paid needs `approve_payroll` and stores the disbursement date that was entered.
- **Adjustments.**
  - Categories: bonus, arrears, allowance, reimbursement, advance recovery, loan recovery, manual deduction.
  - A reason is required, and removed adjustments are soft-deleted and stay visible.
  - Adding or removing one re-runs the variance checks.
- **Recompute** refuses to drop an item that has adjustments.
- **Held salaries** are carried into the next regular run as arrears.
- **PF.** The percentage in Settings applies unless the salary structure has `pf_override` set.
- **Run outputs:** payroll register CSV, bank advice CSV (with the list of skipped people on screen), and a payslips zip.

## Audit trail
- `App\Support\Audit` is the single place that writes the activity log.
- **Leave.** Each request shows its timeline: requested, each approval step, cancelled, ended early. Rejecting or approving requires a decider.
- **People.** The profile has an Activity tab that logs:
  - salary changes, with old and new gross
  - bank account changes (masked)
  - edited fields, before and after
  - documents, assets, roles and permissions
- **Settings → Audit log.** Filter, page through and export the log.

## Reports
The Reports page is grouped into Attendance, Leave, People and Payroll. Every report has filters and a CSV export with a byte-order mark, so Bangla text opens correctly in Excel. Team leads see the attendance and leave reports for their own team.

| Area | Reports |
|---|---|
| Attendance | Monthly summary (with hours and overtime), daily attendance and who's in, late and early leave |
| Leave | Leave register, leave balances |
| People | Headcount, joiners and leavers |
| Payroll | Salary change history, monthly TDS |

## Operations
- **Error pages** for 404, 419, 429, 500 and 503 when debug mode is off.
- **Deploy** builds into `public/build-next` and swaps it in, so the site never runs without a manifest. Old assets are kept for 7 days.
- **Nightly backup** on vivadev: `/root/hr-backup.sh` runs at 02:30 Dhaka and writes to `/root/backups/nightly`, keeping 14 days. It backs up the database and `storage/app`. The copies stay on the same server; an off-site copy is still to do.
