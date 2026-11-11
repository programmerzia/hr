<?php

namespace App\Http\Controllers\People;

use App\Http\Controllers\Controller;
use App\Http\Resources\DepartmentResource;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\TeamResource;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Team;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DirectoryController extends Controller
{
    public function index(Request $request): Response
    {
        $teams = Team::orderBy('name')->get();
        $departments = Department::orderBy('name')->get();
        $teamsById = $teams->keyBy('id');
        $deptsById = $departments->keyBy('id');
        $employeesById = Employee::pluck('name', 'id');
        $manage = $request->user()->can('manage_people');

        $employees = Employee::orderBy('name')->get()->map(function (Employee $e) use ($teamsById, $deptsById, $employeesById, $manage, $request) {
            $row = EmployeeResource::make($e)->resolve($request);
            $team = $e->team_id ? $teamsById->get($e->team_id) : null;
            if (! $manage) {
                $row['phone'] = '';
                $row['nid'] = '';
            }

            return $row + [
                'department_name' => $deptsById->get($e->department_id)?->name,
                'team_name' => $team?->name,
                'lead_name' => $team && $team->lead_employee_id !== $e->id ? $employeesById->get($team->lead_employee_id) : null,
            ];
        })->values();

        return Inertia::render('People/DirectoryPage', [
            'employees' => $employees,
            'departments' => DepartmentResource::collection($departments)->resolve($request),
            'teams' => TeamResource::collection($teams)->resolve($request),
            'filters' => [
                'search' => (string) $request->query('search', ''),
                'department' => (string) $request->query('department', 'all'),
                'team' => (string) $request->query('team', 'all'),
                'type' => (string) $request->query('type', 'all'),
                'status' => (string) $request->query('status', 'all'),
            ],
        ]);
    }
}
