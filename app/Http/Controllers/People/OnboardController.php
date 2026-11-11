<?php

namespace App\Http\Controllers\People;

use App\Domain\People\Actions\Concerns;
use App\Domain\People\Actions\OnboardEmployee;
use App\Http\Controllers\Controller;
use App\Http\Requests\People\OnboardRequest;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class OnboardController extends Controller
{
    public function create(): Response
    {
        $names = Employee::pluck('name', 'id');

        return Inertia::render('People/OnboardPage', [
            'departments' => Department::orderBy('name')->get(['id', 'name']),
            'teams' => Team::orderBy('name')->get()->map(fn (Team $t) => [
                'id' => $t->id, 'name' => $t->name, 'department_id' => $t->department_id,
                'lead_employee_id' => $t->lead_employee_id, 'lead_name' => $names->get($t->lead_employee_id),
            ]),
            'default_checklist' => Concerns::DEFAULT_CHECKLIST,
        ]);
    }

    public function store(OnboardRequest $request, OnboardEmployee $onboard): RedirectResponse
    {
        $employee = $onboard($request->payload());

        return redirect()->route('people.profile', $employee)
            ->with('success', "{$employee->name} added")
            ->with('credentials', ['email' => $employee->email, 'temporary_password' => Concerns::TEMP_PASSWORD, 'context' => 'onboard']);
    }
}
