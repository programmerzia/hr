<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Services\DayCalculator;
use App\Domain\Attendance\Services\DayState;
use App\Http\Controllers\Controller;
use App\Http\Resources\AttendanceDayResource;
use App\Http\Resources\AttendancePolicyResource;
use App\Http\Resources\Fmt;
use App\Http\Resources\RegularizationRequestResource;
use App\Http\Resources\TaskTimeEntryResource;
use App\Http\Resources\TimeSegmentResource;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Holiday;
use App\Models\PayrollPolicy;
use App\Models\RegularizationRequest;
use App\Models\Task;
use App\Models\TaskTimeEntry;
use App\Models\TimeSegment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MyDayController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $employee = $request->user()->employee;
        abort_unless($employee, 403);
        $now = now();
        $policy = AttendancePolicy::current();
        $cap = $policy->lunch_cap_minutes;

        $day = DayState::find($employee);
        $segments = $day ? $day->segments()->get() : collect();
        $totals = DayCalculator::totals($segments, $now, $cap);

        $start = $now->copy()->startOfWeek(Carbon::SUNDAY)->startOfDay();
        $end = $start->copy()->addDays(6);
        $weekDays = AttendanceDay::where('employee_id', $employee->id)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])->get()
            ->keyBy(fn ($d) => $d->date->format('Y-m-d'));
        $weekSegs = TimeSegment::whereIn('attendance_day_id', $weekDays->pluck('id'))->get()->groupBy('attendance_day_id');
        $holidays = Holiday::whereBetween('date', [$start->toDateString(), $end->toDateString()])->get()
            ->mapWithKeys(fn ($h) => [$h->date->format('Y-m-d') => $h->name]);
        $regs = RegularizationRequest::where('employee_id', $employee->id)->latest()->get();

        $week = [];
        for ($i = 0; $i < 7; $i++) {
            $d = $start->copy()->addDays($i);
            $key = $d->toDateString();
            $rec = $weekDays[$key] ?? null;
            $t = DayCalculator::totals($rec ? ($weekSegs[$rec->id] ?? []) : [], $now, $cap);
            $dayRegs = $rec ? $regs->where('attendance_day_id', $rec->id) : collect();
            $week[] = [
                'date' => $key,
                'day' => $rec ? AttendanceDayResource::make($rec)->resolve() : null,
                'totals' => $t,
                'off' => in_array($d->dayOfWeek, $policy->weekend_days ?? [], true) ? 'Weekend' : (isset($holidays[$key]) ? 'Holiday' : null),
                'regularization' => $dayRegs->contains('status', 'pending') ? 'pending' : ($dayRegs->contains('status', 'rejected') ? 'rejected' : null),
            ];
        }

        $entries = TaskTimeEntry::where('employee_id', $employee->id)
            ->where('started_at', '>=', $now->copy()->startOfDay())->get();

        $tasks = Task::with('project')->where('assignee_id', $employee->id)
            ->whereHas('project', fn ($q) => $q->where('status', 'active'))
            ->orderBy('project_id')->orderBy('number')->get()
            ->map(fn (Task $t) => ['id' => $t->id, 'key' => $t->key, 'title' => $t->title])->values();

        return Inertia::render('Attendance/MyDayPage', [
            'server_time' => Fmt::dt($now),
            'day' => $day ? AttendanceDayResource::make($day)->resolve() : null,
            'segments' => TimeSegmentResource::collection($segments)->resolve(),
            'totals' => $totals,
            'task_entries' => TaskTimeEntryResource::collection($entries)->resolve(),
            'week' => $week,
            'shift' => [
                'start' => Fmt::dt($now->copy()->setTimeFromTimeString($policy->shift_start)),
                'end' => Fmt::dt($now->copy()->setTimeFromTimeString($policy->shift_end)),
            ],
            'week_target_hours' => $policy->standard_minutes / 60,
            'tasks' => $tasks,
            'current_task_id' => $employee->current_task_id,
            'policy' => AttendancePolicyResource::make($policy)->resolve(),
            'regularizations' => RegularizationRequestResource::collection($regs)->resolve(),
            'late_rule' => $this->lateRule($employee->id, $policy),
            'recent_days' => $this->recentDays($employee->id, $regs),
        ]);
    }

    /** Late units this month (unregularised lates, plus early leaves when the policy counts them) vs the penalty rule. */
    private function lateRule(string $employeeId, AttendancePolicy $policy): array
    {
        $pay = PayrollPolicy::current();
        $days = AttendanceDay::where('employee_id', $employeeId)->where('is_regularized', false)
            ->whereBetween('date', [now()->startOfMonth()->toDateString(), now()->toDateString()])->get();
        $count = $days->where('late_minutes', '>', 0)->count()
            + ($policy->early_counts_as_late ? $days->where('early_minutes', '>', 0)->count() : 0);

        return ['enabled' => (bool) $pay->late_penalty_enabled, 'lates_per_penalty' => (int) $pay->lates_per_penalty, 'count_this_month' => $count];
    }

    /** Closed days this month that can still be regularised (absent, half day, auto-closed, early). */
    private function recentDays(string $employeeId, $regs): array
    {
        return AttendanceDay::where('employee_id', $employeeId)->where('is_regularized', false)
            ->whereBetween('date', [now()->startOfMonth()->toDateString(), now()->subDay()->toDateString()])
            ->where(fn ($q) => $q->whereIn('absence_kind', ['unapproved', 'half_day'])->orWhere('auto_closed', true)->orWhere('early_minutes', '>', 0))
            ->orderByDesc('date')->get()
            ->map(fn ($d) => [
                'day' => AttendanceDayResource::make($d)->resolve(),
                'regularization' => $regs->where('attendance_day_id', $d->id)->contains('status', 'pending') ? 'pending'
                    : ($regs->where('attendance_day_id', $d->id)->contains('status', 'rejected') ? 'rejected' : null),
            ])->all();
    }
}
