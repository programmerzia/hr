<?php

namespace App\Domain\Leave\Actions;

use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Services\LeaveNotifier;
use App\Domain\Leave\Services\PayrollGuard;
use App\Models\Attachment;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Support\Audit;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class SubmitLeave
{
    private const ACTIVE = ['pending_lead', 'pending_hr', 'approved'];

    public function __construct(private BalanceService $balances, private LeaveNotifier $notifier) {}

    public function __invoke(Employee $employee, ?string $typeId, ?string $startsOn, ?string $endsOn, string $half, ?string $reason, ?UploadedFile $attachment = null): LeaveRequest
    {
        $type = $typeId ? LeaveType::find($typeId) : null;
        if (! $type) {
            Fail::with('Choose a leave type');
        }
        if (! $type->allowed_on_probation && self::onProbation($employee)) {
            Fail::with('This leave type is not available during probation.');
        }
        if (! $startsOn || ! $endsOn) {
            Fail::with('Choose the dates');
        }
        if ($endsOn < $startsOn) {
            Fail::with('End date is before the start date');
        }
        $reason = trim((string) $reason);
        if ($reason === '') {
            Fail::with('Add a reason');
        }
        if ($half !== 'none') {
            if (! $type->allows_half_day) {
                Fail::with("{$type->name} leave cannot be taken as a half day");
            }
            if ($startsOn !== $endsOn) {
                Fail::with('A half day needs a single date');
            }
        }
        PayrollGuard::assertOpen($startsOn, $endsOn);
        $byYear = $this->balances->daysByYear($startsOn, $endsOn, $half);
        $days = $this->balances->daysFor($startsOn, $endsOn, $half);
        if ($days <= 0) {
            Fail::with('The selected dates are all weekends or holidays');
        }

        return DB::transaction(function () use ($employee, $type, $startsOn, $endsOn, $half, $reason, $days, $byYear, $attachment) {
            $clash = LeaveRequest::where('employee_id', $employee->id)
                ->whereIn('status', self::ACTIVE)
                ->where('starts_on', '<=', $endsOn)->where('ends_on', '>=', $startsOn)
                ->lockForUpdate()->exists();
            if ($clash) {
                Fail::with('You already have leave on some of these dates');
            }
            foreach ($byYear as $year => $yearDays) {
                $bal = $this->balances->find($employee->id, $type->id, $year);
                if ($bal && ! $bal['unlimited'] && $yearDays > $bal['available']) {
                    $a = $bal['available'];
                    Fail::with('Only '.$this->num($a).' '.($a == 1 ? 'day' : 'days').' of '.mb_strtolower(preg_replace('/\s+leave$/i', '', $type->name)).' leave available'.(count($byYear) > 1 ? " in {$year}" : ''));
                }
            }
            $request = LeaveRequest::create([
                'employee_id' => $employee->id,
                'leave_type_id' => $type->id,
                'starts_on' => $startsOn,
                'ends_on' => $endsOn,
                'half_day' => $half,
                'days' => $days,
                'year_split' => count($byYear) > 1 ? array_map('floatval', $byYear) : null,
                'reason' => $reason,
                'status' => LeaveNotifier::leadUser($employee) ? 'pending_lead' : 'pending_hr',
            ]);
            if ($attachment) {
                $path = $attachment->store("leave-attachments/{$request->id}", 'local');
                Attachment::create([
                    'attachable_type' => 'leave_request', 'attachable_id' => $request->id,
                    'name' => $attachment->getClientOriginalName(), 'mime' => (string) $attachment->getMimeType(),
                    'size' => (int) $attachment->getSize(), 'path' => $path,
                ]);
                $request->update(['attachment_path' => $path]);
            }
            Audit::log($request, 'Requested', $employee->user, ['days' => $days]);
            $this->balances->adjust($request, pending: $days);
            $this->notifier->toNextDecider($request);

            return $request;
        });
    }

    public static function onProbation(Employee $employee): bool
    {
        return $employee->status === 'probation'
            || ($employee->probation_until !== null && $employee->probation_until->startOfDay()->gte(now()->startOfDay()));
    }

    private function num(float $n): string
    {
        return rtrim(rtrim(number_format($n, 2, '.', ''), '0'), '.');
    }
}
