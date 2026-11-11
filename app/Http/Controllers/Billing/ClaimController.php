<?php

namespace App\Http\Controllers\Billing;

use App\Domain\Billing\Actions\ApproveClaim;
use App\Domain\Billing\Actions\GenerateClaim;
use App\Domain\Billing\Actions\PayClaim;
use App\Domain\Billing\Actions\SubmitClaim;
use App\Domain\Billing\Actions\UpdateClaim;
use App\Domain\Billing\Actions\VerifyClaim;
use App\Domain\Billing\Services\ClaimScope;
use App\Domain\Billing\Services\TrackedTime;
use App\Domain\Billing\Support\Audit;
use App\Http\Controllers\Controller;
use App\Http\Requests\Billing\GenerateClaimRequest;
use App\Http\Requests\Billing\PayClaimRequest;
use App\Http\Requests\Billing\UpdateClaimRequest;
use App\Http\Resources\BankAccountResource;
use App\Http\Resources\ContractorClaimResource;
use App\Http\Resources\EmployeeResource;
use App\Models\ContractorClaim;
use App\Models\Employee;
use App\Policies\ContractorClaimPolicy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ClaimController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', ContractorClaim::class);
        $user = $request->user();
        $policy = new ContractorClaimPolicy;
        $claims = ClaimScope::visible($user)->orderByDesc('year')->orderByDesc('month')->get();
        $awaiting = ClaimScope::awaiting($user)->pluck('id')->all();
        $now = now();

        return Inertia::render('Billing/ClaimsPage', [
            'claims' => ContractorClaimResource::collection($claims)->resolve(),
            'people' => Employee::whereIn('id', $claims->pluck('employee_id')->unique())->get(['id', 'name']),
            'actions' => $claims->mapWithKeys(fn ($c) => [$c->id => $policy->next($user, $c)])->filter()->all() ?: new \stdClass,
            'awaiting' => $awaiting,
            'mode' => match ($user->role) {
                'management' => 'management', 'hr' => 'hr', 'team_lead' => 'lead', default => 'contractor',
            },
            'period' => ['year' => (int) $now->format('Y'), 'month' => (int) $now->format('n')],
            'can_generate' => $user->employee?->employment_type === 'contractor',
        ]);
    }

    public function generate(GenerateClaimRequest $request, GenerateClaim $generate): RedirectResponse
    {
        $user = $request->user();
        $employeeId = $request->validated('employee_id') ?: $user->employee_id;
        if ($employeeId !== $user->employee_id) {
            Gate::forUser($user)->authorize('generateFor', ContractorClaim::class);
        }
        $claim = $generate(Employee::findOrFail($employeeId), (int) $request->validated('year'), (int) $request->validated('month'), $user->employee_id);

        return redirect()->route('billing.claims.show', $claim)->with('success', 'Claim generated');
    }

    public function show(Request $request, ContractorClaim $claim): Response
    {
        Gate::authorize('view', $claim);

        return Inertia::render('Billing/ClaimDetailPage', $this->detail($request, $claim) + [
            'action' => (new ContractorClaimPolicy)->next($request->user(), $claim),
            'can_edit' => $claim->status === 'draft' && Gate::allows('update', $claim),
        ]);
    }

    /** Bare layout sheet for printing. */
    public function print(Request $request, ContractorClaim $claim): Response
    {
        Gate::authorize('view', $claim);

        return Inertia::render('Billing/ClaimPrintPage', $this->detail($request, $claim));
    }

    /** @return array<string, mixed> */
    private function detail(Request $request, ContractorClaim $claim): array
    {
        $employee = $claim->employee;
        $lead = $employee->team?->lead;

        return [
            'claim' => ContractorClaimResource::make($claim)->resolve(),
            'employee' => EmployeeResource::make($employee)->resolve(),
            'lead' => $lead && $lead->id !== $employee->id ? $lead->only(['id', 'name']) : null,
            'bank' => ($bank = $claim->bankAccount ?? $employee->bankAccounts()->orderByDesc('is_primary')->first()) ? BankAccountResource::make($bank)->resolve() : null,
            'weeks' => TrackedTime::weekly($employee->id, $claim->year, $claim->month),
            'audit' => Audit::entries('claim', $claim->id),
        ];
    }

    public function update(UpdateClaimRequest $request, ContractorClaim $claim, UpdateClaim $update): RedirectResponse
    {
        Gate::authorize('update', $claim);
        $update($claim, $request->validated(), $request->user()->employee_id);

        return back()->with('success', 'Claim updated');
    }

    public function submit(Request $request, ContractorClaim $claim, SubmitClaim $submit): RedirectResponse
    {
        Gate::authorize('submit', $claim);
        $submit($claim, $request->user()->employee_id);

        return back()->with('success', 'Claim submitted');
    }

    public function verify(Request $request, ContractorClaim $claim, VerifyClaim $verify): RedirectResponse
    {
        Gate::authorize('verify', $claim);
        $verify($claim, $request->user()->employee);

        return back()->with('success', 'Hours verified');
    }

    public function approve(Request $request, ContractorClaim $claim, ApproveClaim $approve): RedirectResponse
    {
        Gate::authorize('approve', $claim);
        $approve($claim, $request->user()->employee);

        return back()->with('success', 'Claim approved');
    }

    public function pay(PayClaimRequest $request, ContractorClaim $claim, PayClaim $pay): RedirectResponse
    {
        Gate::authorize('pay', $claim);
        $pay($claim, $request->validated('paid_on'), $request->validated('reference'), $request->user()->employee_id);

        return back()->with('success', 'Claim marked as paid');
    }
}
