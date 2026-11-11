<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Services\DayCalculator;
use App\Domain\Attendance\Services\Presence;
use App\Domain\Attendance\Services\Scope;
use App\Http\Controllers\Controller;
use App\Http\Resources\AttendanceDayResource;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\Fmt;
use App\Http\Resources\TeamResource;
use App\Http\Resources\TimeSegmentResource;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Task;
use App\Models\TaskTimeEntry;
use App\Models\Team;
use App\Models\TimeSegment;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $now = now();
        $cap = AttendancePolicy::current()->lunch_cap_minutes;
        $employees = Scope::employees($request->user())->with('user')->orderBy('name')->get();
        $ids = $employees->pluck('id');

        $days = AttendanceDay::whereIn('employee_id', $ids)->whereDate('date', $now->toDateString())->get()->keyBy('employee_id');
        $segs = TimeSegment::whereIn('attendance_day_id', $days->pluck('id'))->orderBy('started_at')->get()->groupBy('attendance_day_id');
        $entries = TaskTimeEntry::whereIn('employee_id', $ids)->whereNull('ended_at')->get()->keyBy('employee_id');
        $tasks = Task::with('project')->whereIn('id', $entries->pluck('task_id'))->get()->keyBy('id');

        $members = $employees->map(function ($e) use ($days, $segs, $entries, $tasks, $now, $cap) {
            $day = $days[$e->id] ?? null;
            $list = $day ? ($segs[$day->id] ?? collect()) : collect();
            $open = $list->firstWhere('ended_at', null);
            $presence = Presence::of($day, $e->user?->last_seen_at, $now);
            $entry = $entries[$e->id] ?? null;
            $task = $entry ? ($tasks[$entry->task_id] ?? null) : null;

            return [
                'employee' => EmployeeResource::make($e)->resolve(),
                'day' => $day ? AttendanceDayResource::make($day)->resolve() : null,
                'open_segment' => $open ? TimeSegmentResource::make($open)->resolve() : null,
                'presence' => $presence['state'],
                'offline_since' => Fmt::dt($presence['offline_since']),
                'totals' => DayCalculator::totals($list, $now, $cap),
                'task' => $task ? ['id' => $task->id, 'key' => $task->key, 'title' => $task->title] : null,
            ];
        })->values();

        return Inertia::render('Attendance/TeamPage', [
            'server_time' => Fmt::dt($now),
            'members' => $members,
            'teams' => TeamResource::collection(Team::orderBy('name')->get())->resolve(),
        ]);
    }
}
