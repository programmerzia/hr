<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Actions\EndDay;
use App\Domain\Attendance\Actions\Heartbeat;
use App\Domain\Attendance\Actions\SetCurrentTask;
use App\Domain\Attendance\Actions\StartBreak;
use App\Domain\Attendance\Actions\StartWork;
use App\Domain\Attendance\Services\Reconciler;
use App\Http\Controllers\Controller;
use App\Models\Task;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    public function heartbeat(Request $request, Heartbeat $heartbeat): RedirectResponse
    {
        $data = $request->validate([
            'last_activity_at' => ['nullable', 'date'],
            // What the client saw while it was not sending beats (see Reconciler::GAP_NOTES) and when it started.
            'gap_reason' => ['nullable', Rule::in(array_keys(Reconciler::GAP_NOTES))],
            'gap_since' => ['nullable', 'date'],
            'offline_since' => ['nullable', 'date'], // clients before gap_reason: same as gap_reason=no_internet
        ]);
        $at = fn (?string $v) => $v ? Carbon::parse($v)->setTimezone(config('app.timezone')) : null;
        $reason = $data['gap_reason'] ?? (isset($data['offline_since']) ? 'no_internet' : null);
        $heartbeat($request->user(), $at($data['last_activity_at'] ?? null), $reason, $at($data['gap_since'] ?? $data['offline_since'] ?? null));

        return back();
    }

    public function break(Request $request, StartBreak $startBreak): RedirectResponse
    {
        $data = $request->validate([
            'category' => ['required', Rule::in(['short', 'tea', 'lunch', 'official', 'signed_out'])],
            'note' => ['nullable', 'string', 'max:255'],
        ]);
        if (! $startBreak($request->user()->employee, $data['category'], $data['note'] ?? null)) {
            return back()->with('error', 'You are not working right now');
        }

        return back();
    }

    public function resume(Request $request, StartWork $startWork): RedirectResponse
    {
        $data = $request->validate(['confirm_overtime' => ['sometimes', 'boolean'], 'confirm_leave' => ['sometimes', 'boolean']]);
        $result = $startWork($request->user()->employee, (bool) ($data['confirm_overtime'] ?? false), (bool) ($data['confirm_leave'] ?? false));
        if ($result === StartWork::NEEDS_LEAVE_CONFIRM) {
            $leave = StartWork::leaveToday($request->user()->employee);
            $range = $leave ? $leave->starts_on->format('M j').($leave->starts_on->equalTo($leave->ends_on) ? '' : ' to '.$leave->ends_on->format('M j')) : '';

            return back()->withErrors(['needs_leave_confirm' => "You're on approved leave today ({$leave?->leaveType?->name}, {$range}). Starting work ends your leave from today and returns those days to your balance."]);
        }
        if ($result === StartWork::NEEDS_OVERTIME_CONFIRM) {
            return back()->withErrors(['needs_overtime_confirm' => 'You ended your day already. Start an overtime session?']);
        }
        $request->user()->forceFill(['last_seen_at' => now()])->save();

        return back();
    }

    public function endDay(Request $request, EndDay $endDay): RedirectResponse
    {
        if (! $endDay($request->user()->employee)) {
            return back()->with('error', 'There is no running day to end');
        }

        return back();
    }

    public function currentTask(Request $request, SetCurrentTask $setCurrentTask): RedirectResponse
    {
        $data = $request->validate(['task_id' => ['nullable', 'uuid', 'exists:tasks,id']]);
        if (! empty($data['task_id'])) {
            Gate::authorize('view', Task::findOrFail($data['task_id']));
        }
        $setCurrentTask($request->user()->employee, $data['task_id'] ?? null);

        return back();
    }
}
