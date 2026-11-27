<?php

namespace App\Domain\Reports;

use App\Models\Employee;
use App\Models\LeaveApproval;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Support\Facades\Schema;

/** Leave requests overlapping a date range with each approver's decision. Cancelled-by columns appear when the table has them. */
final class LeaveRegister
{
    /** @param list<string> $ids @return array<string,mixed> */
    public static function for(string $from, string $to, array $ids): array
    {
        $requests = LeaveRequest::with(['employee', 'leaveType'])->whereIn('employee_id', $ids)
            ->whereDate('starts_on', '<=', $to)->whereDate('ends_on', '>=', $from)->orderBy('starts_on')->orderBy('created_at')->get();
        $approvals = LeaveApproval::with('decidedByEmployee')->whereIn('leave_request_id', $requests->pluck('id'))->orderBy('decided_at')->get()->groupBy('leave_request_id');
        $hasCancel = Schema::hasColumn('leave_requests', 'cancelled_by') && Schema::hasColumn('leave_requests', 'cancelled_at');
        $cancellers = [];
        if ($hasCancel) {
            $raw = $requests->pluck('cancelled_by')->filter()->unique()->all();
            $cancellers = Employee::whereIn('id', $raw)->pluck('name', 'id')->all()
                + User::whereIn('id', $raw)->pluck('name', 'id')->all();
        }

        $rows = [];
        foreach ($requests as $r) {
            $a = $approvals[$r->id] ?? collect();
            $lead = $a->where('stage', 'lead')->last();
            $hr = $a->where('stage', 'hr')->last();
            $fmt = fn ($x) => $x ? $x->decidedByEmployee?->name.' ('.$x->decision.')' : '';
            $row = [
                'code' => $r->employee?->code, 'name' => $r->employee?->name, 'type' => $r->leaveType?->name,
                'paid' => $r->leaveType?->is_paid ? 'Paid' : 'Unpaid',
                'starts_on' => $r->starts_on->format('Y-m-d'), 'ends_on' => $r->ends_on->format('Y-m-d'),
                'days' => (float) $r->days, 'status' => str_replace('_', ' ', $r->status),
                'requested_at' => $r->created_at?->timezone(config('app.timezone'))->format('Y-m-d H:i'),
                'lead' => $fmt($lead), 'lead_at' => $lead?->decided_at?->timezone(config('app.timezone'))->format('Y-m-d H:i') ?? '',
                'hr' => $fmt($hr), 'hr_at' => $hr?->decided_at?->timezone(config('app.timezone'))->format('Y-m-d H:i') ?? '',
            ];
            if ($hasCancel) {
                $row['cancelled_by'] = $r->cancelled_by ? ($cancellers[$r->cancelled_by] ?? '') : '';
                $row['cancelled_at'] = $r->cancelled_at ? \Carbon\Carbon::parse($r->cancelled_at)->timezone(config('app.timezone'))->format('Y-m-d H:i') : '';
            }
            $rows[] = $row;
        }
        $cols = [
            ['code', 'Code'], ['name', 'Employee'], ['type', 'Type'], ['paid', 'Paid'], ['starts_on', 'From', 'date'], ['ends_on', 'To', 'date'],
            ['days', 'Days', 'dec'], ['status', 'Status'], ['requested_at', 'Requested'], ['lead', 'Lead decision'], ['lead_at', 'Lead at'], ['hr', 'HR decision'], ['hr_at', 'HR at'],
        ];
        if ($hasCancel) {
            $cols[] = ['cancelled_by', 'Cancelled by'];
            $cols[] = ['cancelled_at', 'Cancelled at'];
        }

        return Table::make($cols, $rows);
    }
}
