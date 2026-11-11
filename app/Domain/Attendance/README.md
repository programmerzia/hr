# Attendance

Port one-to-one from `resources/js/mock/stores/attendance.ts` (same validation messages). Invokable classes in `Actions/`.

Actions to port:
- [x] StartWork, StartBreak, EndDay, Heartbeat (reconcileOffline), SweepIdle, SetCurrentTask
- [ ] RequestRegularization (requestRegularization), DecideRegularization (decideRegularization; AttendanceDayPolicy::regularize)
- Services: DayCalculator (computeTotals), DayState (segment bookkeeping)
