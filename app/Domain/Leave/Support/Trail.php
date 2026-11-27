<?php

namespace App\Domain\Leave\Support;

use App\Http\Resources\Fmt;
use App\Models\Employee;
use App\Models\LeaveApproval;
use App\Models\LeaveRequest;
use App\Models\RegularizationRequest;
use Illuminate\Support\Collection;

/**
 * Who did what on a leave request, oldest first: requested, each approval step, cancelled, ended early.
 * Leave booked by a regularization has no request/approval rows; its source is derived from the regularization.
 */
final class Trail
{
    public const REGULARIZED_REASON = 'Regularised absence';

    /**
     * @param  iterable<LeaveRequest>  $requests
     * @return array<string, list<array{kind:string,at:?string,by:?string,text:string,note:?string}>>
     */
    public static function for(iterable $requests): array
    {
        $requests = collect($requests);
        if ($requests->isEmpty()) {
            return [];
        }
        $approvals = LeaveApproval::whereIn('leave_request_id', $requests->pluck('id'))->orderBy('decided_at')->get()->groupBy('leave_request_id');
        $regs = self::regularizations($requests);
        $names = Employee::whereIn('id', collect()
            ->merge($requests->pluck('employee_id'))->merge($requests->pluck('cancelled_by'))->merge($requests->pluck('ended_early_by'))
            ->merge($approvals->flatten()->pluck('decided_by'))->merge($regs->pluck('decided_by'))->filter()->unique())
            ->pluck('name', 'id');

        return $requests->mapWithKeys(function (LeaveRequest $r) use ($approvals, $regs, $names) {
            $who = fn (?string $id) => $id ? ($names[$id] ?? null) : null;
            $events = [];
            $reg = $regs[$r->id] ?? null;
            if ($reg) {
                $events[] = ['kind' => 'regularization', 'at' => Fmt::dt($reg->decided_at), 'by' => $who($reg->decided_by),
                    'text' => 'Booked as paid leave from a regularization', 'note' => $reg->note];
            } else {
                $events[] = ['kind' => 'requested', 'at' => Fmt::dt($r->created_at), 'by' => $who($r->employee_id), 'text' => 'Requested', 'note' => null];
            }
            foreach ($approvals[$r->id] ?? [] as $a) {
                $stage = $a->stage === 'lead' ? 'Lead' : 'HR';
                $events[] = ['kind' => $a->decision, 'at' => Fmt::dt($a->decided_at), 'by' => $who($a->decided_by),
                    'text' => ($a->decision === 'approved' ? 'Approved' : 'Rejected').' ('.$stage.')', 'note' => $a->note];
            }
            if ($r->ended_early_at || $r->ended_early_by) {
                $events[] = ['kind' => 'ended_early', 'at' => Fmt::dt($r->ended_early_at), 'by' => $who($r->ended_early_by), 'text' => 'Ended early', 'note' => null];
            }
            if ($r->status === 'cancelled' && ! ($r->ended_early_at && $r->ended_early_at->eq($r->cancelled_at))) {
                $events[] = ['kind' => 'cancelled', 'at' => Fmt::dt($r->cancelled_at), 'by' => $who($r->cancelled_by), 'text' => 'Cancelled', 'note' => null];
            }

            return [$r->id => $events];
        })->all();
    }

    /** Paid-leave requests that came from an approved regularization, keyed by leave request id. @return Collection<string, RegularizationRequest> */
    private static function regularizations(Collection $requests): Collection
    {
        $out = collect();
        foreach ($requests->where('reason', self::REGULARIZED_REASON) as $r) {
            $reg = RegularizationRequest::where('employee_id', $r->employee_id)->where('status', 'approved')
                ->where('resolution', 'paid_leave')->where('leave_type_id', $r->leave_type_id)
                ->whereHas('day', fn ($q) => $q->where('date', $r->starts_on->format('Y-m-d')))->latest('decided_at')->first();
            if ($reg) {
                $out[$r->id] = $reg;
            }
        }

        return $out;
    }
}
