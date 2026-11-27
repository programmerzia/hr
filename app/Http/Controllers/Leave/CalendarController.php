<?php

namespace App\Http\Controllers\Leave;

use App\Domain\Attendance\Services\Scope;
use App\Domain\Leave\Support\Shape;
use App\Domain\Leave\Support\Trail;
use App\Http\Controllers\Controller;
use App\Http\Resources\LeaveRequestResource;
use App\Models\AttendancePolicy;
use App\Models\LeaveRequest;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CalendarController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('view_team');
        $user = $request->user();
        $month = preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string) $request->query('month')) ? $request->query('month') : now()->format('Y-m');
        $first = CarbonImmutable::parse("{$month}-01");
        // The grid shows whole work weeks (first day after the weekend), so load the whole visible range.
        $weekStart = AttendancePolicy::current()->weekStartsOn();
        $from = $first->startOfWeek($weekStart)->format('Y-m-d');
        $to = $first->endOfMonth()->endOfWeek(($weekStart + 6) % 7)->format('Y-m-d');

        $wide = Scope::company($user);
        $scope = $wide ? null : array_values(array_unique(array_filter([$user->employee_id, ...Scope::employees($user)->pluck('id')->all()])));

        $events = LeaveRequest::where('status', 'approved')
            ->where('starts_on', '<=', $to)->where('ends_on', '>=', $from)
            ->when($scope !== null, fn ($q) => $q->whereIn('employee_id', $scope))
            ->orderBy('starts_on')->get();

        return Inertia::render('Leave/CalendarPage', [
            'month' => $month,
            'wide' => $wide,
            'events' => LeaveRequestResource::collection($events)->resolve(),
            'trail' => Trail::for($events),
            'people' => Shape::people($wide ? [] : ($scope ?: [$user->employee_id])),
            'teams' => Team::orderBy('name')->get(['id', 'name'])->map->only(['id', 'name'])->all(),
            'leave_types' => Shape::types(),
        ]);
    }
}
