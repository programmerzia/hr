<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Actions\EndDay;
use App\Domain\Attendance\Actions\Heartbeat;
use App\Domain\Attendance\Actions\SetCurrentTask;
use App\Domain\Attendance\Actions\StartBreak;
use App\Domain\Attendance\Actions\StartWork;
use App\Http\Controllers\Controller;
use App\Models\Task;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    public function heartbeat(Request $request, Heartbeat $heartbeat): RedirectResponse
    {
        $heartbeat($request->user());

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
        $data = $request->validate(['confirm_overtime' => ['sometimes', 'boolean']]);
        $result = $startWork($request->user()->employee, (bool) ($data['confirm_overtime'] ?? false));
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
