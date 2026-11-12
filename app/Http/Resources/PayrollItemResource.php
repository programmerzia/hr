<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayrollItemResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'run_id' => $this->run_id,
            'employee_id' => $this->employee_id,
            'salary_structure_id' => $this->salary_structure_id,
            'standard_minutes' => (int) $this->standard_minutes,
            'worked_minutes' => (int) $this->worked_minutes,
            'overtime_minutes' => (int) $this->overtime_minutes,
            'unpaid_leave_days' => (float) $this->unpaid_leave_days,
            'late_count' => (int) $this->late_count,
            'gross' => (int) $this->gross,
            'overtime_pay' => (int) $this->overtime_pay,
            'unpaid_deduction' => (int) $this->unpaid_deduction,
            'late_deduction' => (int) $this->late_deduction,
            'tax' => (int) $this->tax,
            'pf' => (int) $this->pf,
            'net' => (int) $this->net,
            'pf_employer' => (int) $this->pf_employer,
            'leave_encashment' => (int) $this->leave_encashment,
            'eligible_days' => (float) $this->eligible_days,
            'absent_days' => (float) $this->absent_days,
            'half_days' => (float) $this->half_days,
            'paid_leave_days' => (float) $this->paid_leave_days,
            'holiday_days' => (float) $this->holiday_days,
            'lop_days' => (float) $this->lop_days,
            'late_penalty_days' => (float) $this->late_penalty_days,
            'day_fraction_total' => (float) $this->day_fraction_total,
            'components' => $this->components,
            'slices' => $this->slices ?? [],
            'variance_flag' => (bool) $this->variance_flag,
            'variance_kind' => $this->variance_kind ?? 'none',
            'variance_pct' => $this->variance_pct === null ? null : (float) $this->variance_pct,
            'variance_ack_by' => $this->variance_ack_by,
            'variance_ack_at' => Fmt::dt($this->variance_ack_at),
            'hold' => (bool) $this->hold,
            'hold_reason' => $this->hold_reason,
            'payroll_policy_id' => $this->payroll_policy_id,
            'attendance_policy_id' => $this->attendance_policy_id,
            'snapshot_at' => Fmt::dt($this->snapshot_at),
            'bank_account_id' => $this->bank_account_id,
            'payslip_path' => $this->payslip_path,
        ];
    }
}
