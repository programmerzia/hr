<?php

namespace App\Http\Controllers\Settings;

use App\Domain\Attendance\Services\Grading;
use App\Domain\Settings\SettingsLog;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\AttendancePolicyRequest;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AttendancePolicyController extends Controller
{
    public function index(): Response
    {
        $today = now()->toDateString();
        $current = AttendancePolicy::forDate($today);
        $fields = array_keys(AttendancePolicy::DEFAULTS);

        return Inertia::render('Settings/AttendancePolicyPage', [
            'versions' => AttendancePolicy::orderByDesc('effective_from')->get()->map(fn (AttendancePolicy $p) => [
                'id' => $p->id,
                ...collect($p->only($fields))->all(),
                'effective_from' => $p->effective_from->toDateString(),
                'is_current' => $p->id === $current->id,
                'editable' => $this->editable($p),
            ])->all(),
            'today' => $today,
            'defaults' => [...AttendancePolicy::DEFAULTS, 'effective_from' => $today],
            'history' => SettingsLog::recent('attendance'),
        ]);
    }

    public function store(AttendancePolicyRequest $request): RedirectResponse
    {
        $policy = AttendancePolicy::create($request->validated());
        $this->regradeToday();
        SettingsLog::record($request->user(), 'attendance', 'created attendance policy effective '.$policy->effective_from->format('j M Y'), subjectId: $policy->id);

        return back()->with('success', 'New attendance policy takes effect from '.$policy->effective_from->format('j M Y'));
    }

    public function update(AttendancePolicyRequest $request, AttendancePolicy $policy): RedirectResponse
    {
        if (! $this->editable($policy)) {
            return back()->with('error', 'This version started before today and cannot be changed. Create a new version instead.');
        }
        $policy->update($request->validated());
        $this->regradeToday();
        SettingsLog::record($request->user(), 'attendance', 'edited attendance policy effective '.$policy->effective_from->format('j M Y'), subjectId: $policy->id);

        return back()->with('success', 'Attendance policy updated');
    }

    public function destroy(Request $request, AttendancePolicy $policy): RedirectResponse
    {
        if (! $this->editable($policy)) {
            return back()->with('error', 'Only a version that starts today or later can be removed.');
        }
        $policy->delete();
        $this->regradeToday();
        SettingsLog::record($request->user(), 'attendance', 'removed attendance policy effective '.$policy->effective_from->format('j M Y'), subjectId: $policy->id);

        return back()->with('success', 'Upcoming version removed');
    }

    /** History is never rewritten: a version can change until the day after it starts (today's rule is still correctable). */
    private function editable(AttendancePolicy $p): bool
    {
        return $p->effective_from->toDateString() >= now()->toDateString();
    }

    /** Today's already-ended days were graded under the old rule; grade them again under the one in force now. */
    private function regradeToday(): void
    {
        AttendanceDay::whereDate('date', now()->toDateString())->where('status', 'ended')->get()->each(function (AttendanceDay $d) {
            Grading::apply($d);
            $d->save();
        });
    }
}
