<?php

namespace App\Domain\Leave\Actions;

use App\Domain\Attendance\Actions\RegradeDays;
use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Services\LeaveNotifier;
use App\Domain\Leave\Services\PayrollGuard;
use App\Models\LeaveRequest;
use Illuminate\Support\Facades\DB;

/**
 * The person is back before an approved leave ends. From $date the leave stops (the days after go back to the
 * balance); when $date is the first day or earlier the whole request is cancelled.
 */
class EndEarly
{
    public function __construct(private BalanceService $balances, private RegradeDays $regrade, private LeaveNotifier $notifier) {}

    public function __invoke(LeaveRequest $request, ?string $date = null): LeaveRequest
    {
        $date ??= now()->toDateString();

        return DB::transaction(function () use ($request, $date) {
            $r = LeaveRequest::lockForUpdate()->findOrFail($request->id);
            $start = $r->starts_on->format('Y-m-d');
            $end = $r->ends_on->format('Y-m-d');
            if ($r->status !== 'approved' || $date > $end) {
                Fail::with('This leave is not in progress');
            }
            if ($r->half_day !== 'none') {
                Fail::with('A half day cannot be ended early');
            }
            PayrollGuard::assertOpen(max($date, $start), $end);

            $newEnd = date('Y-m-d', strtotime($date.' -1 day'));
            $byYear = $date > $start ? $this->balances->daysByYear($start, $newEnd, 'none') : [];
            $days = $date > $start ? $this->balances->daysFor($start, $newEnd, 'none') : 0.0;

            $this->balances->adjust($r, used: -(float) $r->days);
            if ($days <= 0) {
                $r->update(['status' => 'cancelled']);
            } else {
                $r->update([
                    'ends_on' => $newEnd,
                    'days' => $days,
                    'year_split' => count($byYear) > 1 ? array_map('floatval', $byYear) : null,
                ]);
                $this->balances->adjust($r->fresh(), used: $days);
            }
            $this->regrade->__invoke($r->employee_id, max($date, $start), $end);
            $r->loadMissing('employee');
            $this->notifier->toDeciders($r, ($r->employee->name).' is back from leave early');

            return $r;
        });
    }
}
