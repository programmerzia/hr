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
            'bank_account_id' => $this->bank_account_id,
            'payslip_path' => $this->payslip_path,
        ];
    }
}
