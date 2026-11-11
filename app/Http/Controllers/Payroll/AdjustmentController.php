<?php

namespace App\Http\Controllers\Payroll;

use App\Domain\Payroll\Actions\AddAdjustment;
use App\Domain\Payroll\Actions\RemoveAdjustment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payroll\StoreAdjustmentRequest;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class AdjustmentController extends Controller
{
    public function store(StoreAdjustmentRequest $form, PayrollItem $item, AddAdjustment $action): RedirectResponse
    {
        Gate::authorize('manage_payroll');
        $action($item, $form->validated('kind'), (string) $form->validated('label'), (float) $form->validated('amount'), $form->validated('note'), $form->user()->employee);

        return back()->with('success', 'Adjustment added');
    }

    public function destroy(Request $request, PayrollAdjustment $adjustment, RemoveAdjustment $action): RedirectResponse
    {
        Gate::authorize('manage_payroll');
        $action($adjustment, $request->user()->employee);

        return back()->with('success', 'Adjustment removed');
    }
}
