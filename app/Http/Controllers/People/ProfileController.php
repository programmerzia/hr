<?php

namespace App\Http\Controllers\People;

use App\Domain\Attendance\Services\Series;
use App\Domain\People\Actions\AddAsset;
use App\Domain\People\Actions\AddDocument;
use App\Domain\People\Actions\AddSalaryStructure;
use App\Domain\People\Actions\ChangeStatus;
use App\Domain\People\Actions\ResetPassword;
use App\Domain\People\Actions\ToggleChecklistItem;
use App\Domain\People\Actions\UpdateBankAccount;
use App\Domain\People\Actions\UpdateEmployee;
use App\Http\Controllers\Controller;
use App\Http\Requests\People\AssetRequest;
use App\Http\Requests\People\BankRequest;
use App\Http\Requests\People\ChangeStatusRequest;
use App\Http\Requests\People\DocumentRequest;
use App\Http\Requests\People\SalaryRequest;
use App\Http\Requests\People\UpdateEmployeeRequest;
use App\Http\Resources\BankAccountResource;
use App\Http\Resources\EmployeeAssetResource;
use App\Http\Resources\EmployeeDocumentResource;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\OnboardingChecklistItemResource;
use App\Http\Resources\SalaryStructureResource;
use App\Http\Resources\TeamResource;
use App\Http\Resources\UserResource;
use App\Models\ActivityLogEntry;
use App\Models\AttendanceDay;
use App\Models\BankAccount;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeAsset;
use App\Models\EmployeeDocument;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\OnboardingChecklistItem;
use App\Models\SalaryStructure;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function show(Request $request, Employee $employee): Response
    {
        Gate::authorize('view', $employee);
        $viewer = $request->user();
        $pay = $viewer->can('viewPay', $employee);
        $manage = $viewer->can('manage_people');

        $team = $employee->team_id ? Team::find($employee->team_id) : null;
        $lead = $team && $team->lead_employee_id !== $employee->id && $team->lead_employee_id ? Employee::find($team->lead_employee_id) : null;
        $today = now()->toDateString();
        $year = (int) now()->format('Y');

        $leave = LeaveType::orderBy('name')->get()->map(function (LeaveType $t) use ($employee, $year) {
            $b = LeaveBalance::where(['employee_id' => $employee->id, 'leave_type_id' => $t->id, 'year' => $year])->first();
            $entitled = (float) ($b?->entitled ?? $t->annual_quota);
            $used = (float) ($b?->used ?? 0);
            $pending = (float) ($b?->pending ?? 0);
            $unlimited = ! $t->is_paid && (float) $t->annual_quota === 0.0;

            return [
                'id' => $t->id, 'name' => $t->name, 'unlimited' => $unlimited,
                'entitled' => $entitled, 'used' => $used, 'pending' => $pending,
                'available' => $unlimited ? null : max(0, $entitled - $used - $pending),
            ];
        })->filter(fn ($r) => $r['unlimited'] || $r['entitled'] > 0 || $r['used'] > 0 || $r['pending'] > 0)->values();

        $props = [
            'employee' => EmployeeResource::make($employee)->resolve($request),
            'teams' => TeamResource::collection(Team::orderBy('name')->get())->resolve($request),
            'department_name' => Department::find($employee->department_id)?->name,
            'team' => $team ? TeamResource::make($team)->resolve($request) : null,
            'lead' => $lead ? ['id' => $lead->id, 'name' => $lead->name] : null,
            'user' => $manage && ($u = User::where('employee_id', $employee->id)->first()) ? UserResource::make($u)->resolve($request) : null,
            'salary' => $pay ? SalaryStructureResource::collection(SalaryStructure::where('employee_id', $employee->id)->orderByDesc('effective_from')->get())->resolve($request) : null,
            'bank' => $pay ? ($b = BankAccount::where('employee_id', $employee->id)->where('is_primary', true)->first()) ? BankAccountResource::make($b)->resolve($request) : null : null,
            'documents' => $pay ? EmployeeDocumentResource::collection(EmployeeDocument::where('employee_id', $employee->id)->orderBy('uploaded_at')->get())->resolve($request) : null,
            'assets' => EmployeeAssetResource::collection(EmployeeAsset::where('employee_id', $employee->id)->orderBy('assigned_on')->get())->resolve($request),
            'checklist' => OnboardingChecklistItemResource::collection(OnboardingChecklistItem::where('employee_id', $employee->id)->orderBy('created_at')->orderBy('id')->get())->resolve($request),
            'history' => ActivityLogEntry::where('subject_type', 'employee')->where('subject_id', $employee->id)->get()
                ->map(fn ($e) => ['id' => $e->id, 'effective_on' => $e->properties['effective_on'] ?? $e->created_at->toDateString(), 'kind' => $e->properties['kind'] ?? 'status', 'text' => $e->description])
                ->sortByDesc('effective_on')->values(),
            'heat' => Series::heat([$employee->id], now()),
            'month_weeks' => [$employee->id => Series::monthWeeks($employee->id, now())],
            'presence' => AttendanceDay::where('employee_id', $employee->id)->whereDate('date', $today)->value('status') ?? 'not_started',
            'leave_balances' => $leave,
            'credentials' => $manage ? $request->session()->get('credentials') : null,
        ];

        return Inertia::render('People/ProfilePage', $props);
    }

    public function update(UpdateEmployeeRequest $request, Employee $employee, UpdateEmployee $action): RedirectResponse
    {
        $action($employee, $request->validated());

        return back()->with('success', 'Details saved');
    }

    public function status(ChangeStatusRequest $request, Employee $employee, ChangeStatus $action): RedirectResponse
    {
        $action($employee, $request->validated('status'), $request->validated('effective_on'));

        return back()->with('success', 'Status updated');
    }

    public function salary(SalaryRequest $request, Employee $employee, AddSalaryStructure $action): RedirectResponse
    {
        $extra = $request->validate([
            'pf_employer_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'other_allowances' => ['nullable', 'array', 'max:10'],
            'other_allowances.*.label' => ['required', 'string', 'max:60'],
            'other_allowances.*.amount' => ['required', 'integer', 'min:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ], [
            'pf_employer_percent.*' => 'Enter a percentage from 0 to 100',
            'other_allowances.*.label.required' => 'Name the allowance',
            'other_allowances.*.amount.*' => 'Enter an amount, 0 or more',
        ]);
        $structure = $action($employee, $request->payload());
        if ($employee->employment_type !== 'contractor') {
            $others = array_values(array_map(fn ($a) => ['label' => trim($a['label']), 'amount' => (int) $a['amount']], $extra['other_allowances'] ?? []));
            $gross = (int) $structure->gross + array_sum(array_column($others, 'amount'));
            $structure->update([
                'pf_employer_percent' => isset($extra['pf_employer_percent']) && $extra['pf_employer_percent'] !== '' ? (float) $extra['pf_employer_percent'] : null,
                'other_allowances' => $others ?: null,
                'note' => trim((string) ($extra['note'] ?? '')) ?: null,
                'gross' => $gross,
                'hourly_rate' => $request->input('hourly_rate') ? $structure->hourly_rate : (int) round($gross / 22 / 8),
            ]);
        }

        return back()->with('success', 'Salary structure added');
    }

    public function bank(BankRequest $request, Employee $employee, UpdateBankAccount $action): RedirectResponse
    {
        $action($employee, $request->validated());

        return back()->with('success', 'Bank account saved');
    }

    public function toggleChecklist(OnboardingChecklistItem $item, ToggleChecklistItem $action): RedirectResponse
    {
        $action($item);

        return back();
    }

    public function document(DocumentRequest $request, Employee $employee, AddDocument $action): RedirectResponse
    {
        $action($employee, $request->validated('kind'), $request->file('file'));

        return back()->with('success', 'Document added');
    }

    public function downloadDocument(Employee $employee, EmployeeDocument $document)
    {
        Gate::authorize('viewPay', $employee); // same gate that shows the documents list
        abort_unless(Storage::disk('local')->exists($document->path), 404);

        return Storage::disk('local')->download($document->path, $document->name);
    }

    public function asset(AssetRequest $request, Employee $employee, AddAsset $action): RedirectResponse
    {
        $action($employee, $request->validated());

        return back()->with('success', 'Asset assigned');
    }

    public function resetPassword(Employee $employee, ResetPassword $action): RedirectResponse
    {
        Gate::authorize('resetPassword', $employee);
        $temp = $action($employee);

        return back()->with('credentials', ['email' => $employee->email, 'temporary_password' => $temp, 'context' => 'reset']);
    }
}
