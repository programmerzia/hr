<?php

namespace App\Http\Controllers\Payroll;

use App\Domain\Payroll\Support\Shape;
use App\Http\Controllers\Controller;
use App\Http\Resources\BankAccountResource;
use App\Http\Resources\PayrollRunResource;
use App\Http\Resources\SalaryStructureResource;
use App\Models\Department;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PayslipController extends Controller
{
    public function show(Request $request, PayrollItem $item): Response
    {
        $run = PayrollRun::findOrFail($item->run_id);
        Gate::authorize('viewPayslip', [$run, $item]);
        $emp = $item->employee()->firstOrFail();

        return Inertia::render('Payroll/PayslipPage', [
            'run' => PayrollRunResource::make($run)->resolve(),
            'item' => Shape::item($item),
            'adjustments' => Shape::adjustments(PayrollAdjustment::where('item_id', $item->id)->orderBy('created_at')->get()),
            'employee' => Shape::people([$emp->id])[0],
            'department' => $emp->department_id ? Department::whereKey($emp->department_id)->value('name') : null,
            'salary' => $item->salaryStructure ? SalaryStructureResource::make($item->salaryStructure)->resolve() : null,
            'bank' => $item->bankAccount ? BankAccountResource::make($item->bankAccount)->resolve() : null,
            'policy' => Shape::policy($run, collect([$item])),
            'staff' => Gate::any(['manage_payroll', 'approve_payroll']),
        ]);
    }

    public function mine(Request $request): Response
    {
        $employee = $request->user()->employee;
        abort_unless($employee && $employee->employment_type === 'full_time', 403);
        $items = PayrollItem::where('employee_id', $employee->id)->get();
        $runs = PayrollRun::whereIn('id', $items->pluck('run_id'))->where('status', 'paid')->orderByDesc('year')->orderByDesc('month')->get();

        return Inertia::render('Payroll/MyPayslipsPage', [
            'slips' => $runs->map(fn (PayrollRun $r) => [
                'run' => PayrollRunResource::make($r)->resolve(),
                'item' => Shape::item($items->firstWhere('run_id', $r->id)),
            ])->values()->all(),
        ]);
    }
}
