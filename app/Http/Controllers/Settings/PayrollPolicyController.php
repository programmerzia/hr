<?php

namespace App\Http\Controllers\Settings;

use App\Domain\Settings\PolicyPreview;
use App\Domain\Settings\SettingsLog;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PayrollPolicyRequest;
use App\Models\AttendancePolicy;
use App\Models\PayrollPolicy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PayrollPolicyController extends Controller
{
    public const EXAMPLE_GROSS = 50000;

    public function index(Request $request): Response
    {
        $today = now()->toDateString();
        $current = PayrollPolicy::forDate($today);
        $fields = array_keys(PayrollPolicy::DEFAULTS);

        return Inertia::render('Settings/PayrollPolicyPage', [
            'versions' => PayrollPolicy::orderByDesc('effective_from')->get()->map(fn (PayrollPolicy $p) => [
                'id' => $p->id,
                ...$p->only($fields),
                'effective_from' => $p->effective_from->toDateString(),
                'is_current' => $p->id === $current->id,
                'editable' => $this->editable($p),
            ])->all(),
            'today' => $today,
            'defaults' => [...PayrollPolicy::DEFAULTS, 'effective_from' => $today],
            'example_gross' => self::EXAMPLE_GROSS,
            'preview' => fn () => $this->preview($request),
            'history' => SettingsLog::recent('payroll'),
        ]);
    }

    /** Live preview: the page re-requests this prop with the form values as query parameters. */
    private function preview(Request $request): ?array
    {
        $p = $request->query('p');
        if (! is_array($p)) {
            return null;
        }
        $bool = fn (string $k) => filter_var($p[$k] ?? false, FILTER_VALIDATE_BOOLEAN);
        $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($p['effective_from'] ?? '')) ? $p['effective_from'] : now()->toDateString();
        $basis = in_array($p['daily_rate_basis'] ?? '', ['working_days', 'calendar_days', 'fixed_30', 'fixed_26'], true) ? $p['daily_rate_basis'] : 'working_days';

        return PolicyPreview::compute([
            'daily_rate_basis' => $basis,
            'lop_enabled' => $bool('lop_enabled'),
            'late_penalty_enabled' => $bool('late_penalty_enabled'),
            'lates_per_penalty' => (int) ($p['lates_per_penalty'] ?? 3),
            'penalty_days' => (float) ($p['penalty_days'] ?? 0),
            'max_penalty_days_per_month' => (float) ($p['max_penalty_days_per_month'] ?? 0),
        ], self::EXAMPLE_GROSS, $date, AttendancePolicy::forDate($date));
    }

    public function store(PayrollPolicyRequest $request): RedirectResponse
    {
        $policy = PayrollPolicy::create($request->validated());
        SettingsLog::record($request->user(), 'payroll', 'created payroll policy effective '.$policy->effective_from->format('j M Y').$this->switches($policy), subjectId: $policy->id);

        return back()->with('success', 'New payroll policy takes effect from '.$policy->effective_from->format('j M Y'));
    }

    public function update(PayrollPolicyRequest $request, PayrollPolicy $policy): RedirectResponse
    {
        if (! $this->editable($policy)) {
            return back()->with('error', 'This version is already in force and cannot be changed. Create a new version instead.');
        }
        $policy->update($request->validated());
        SettingsLog::record($request->user(), 'payroll', 'edited upcoming payroll policy effective '.$policy->effective_from->format('j M Y').$this->switches($policy), subjectId: $policy->id);

        return back()->with('success', 'Payroll policy updated');
    }

    public function destroy(Request $request, PayrollPolicy $policy): RedirectResponse
    {
        if (! $this->editable($policy)) {
            return back()->with('error', 'Only an upcoming version can be removed.');
        }
        $policy->delete();
        SettingsLog::record($request->user(), 'payroll', 'removed upcoming payroll policy effective '.$policy->effective_from->format('j M Y'), subjectId: $policy->id);

        return back()->with('success', 'Upcoming version removed');
    }

    /** Not yet started and never used by a payroll item. */
    private function editable(PayrollPolicy $p): bool
    {
        return $p->effective_from->toDateString() > now()->toDateString()
            && ! DB::table('payroll_items')->where('payroll_policy_id', $p->id)->exists();
    }

    private function switches(PayrollPolicy $p): string
    {
        $on = collect(['lop_enabled' => 'absence deduction', 'late_penalty_enabled' => 'late penalty', 'pf_enabled' => 'provident fund', 'tax_enabled' => 'tax', 'overtime_enabled' => 'overtime'])
            ->filter(fn ($l, $k) => $p->{$k})->values()->implode(', ');

        return ' (on: '.($on ?: 'none').')';
    }
}
