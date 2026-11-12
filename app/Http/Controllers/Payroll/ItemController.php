<?php

namespace App\Http\Controllers\Payroll;

use App\Domain\Payroll\Actions\HoldItem;
use App\Http\Controllers\Controller;
use App\Models\PayrollItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ItemController extends Controller
{
    public function hold(Request $request, PayrollItem $item, HoldItem $action): RedirectResponse
    {
        Gate::authorize('manage_payroll');
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], ['reason.required' => 'Give a reason for holding this salary.']);
        $action($item, true, $data['reason'], $request->user()->employee);

        return back()->with('success', 'Salary held');
    }

    public function unhold(Request $request, PayrollItem $item, HoldItem $action): RedirectResponse
    {
        Gate::authorize('manage_payroll');
        $action($item, false, null, $request->user()->employee);

        return back()->with('success', 'Salary released');
    }
}
