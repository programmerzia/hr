<?php

namespace App\Http\Middleware;

use App\Domain\Attendance\Services\DayState;
use App\Http\Resources\AttendanceDayResource;
use App\Http\Resources\AttendancePolicyResource;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\Fmt;
use App\Http\Resources\TimeSegmentResource;
use App\Http\Resources\UserResource;
use App\Models\AttendancePolicy;
use App\Support\Abilities;
use App\Support\Nav;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();
        $employee = $user?->employee;

        return [
            ...parent::share($request),
            'auth' => fn () => $user ? [
                'user' => UserResource::make($user)->resolve($request),
                'employee' => $employee ? EmployeeResource::make($employee)->resolve($request) : null,
                'role' => $user->role,
                'abilities' => Abilities::for($user),
            ] : null,
            'nav' => fn () => $user ? Nav::for($user) : [],
            'badges' => fn () => $user ? self::badges($user) : (object) [],
            'attendance' => fn () => self::attendance($request),
            'flash' => fn () => array_filter([
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ]),
            'ziggy' => fn () => [...(new Ziggy)->toArray(), 'location' => $request->url()],
        ];
    }

    /** Nav badge counts keyed by nav item id. Module agents fill these in. */
    public static function badges($user): array
    {
        return \App\Support\Badges::for($user);
    }

    public static function attendance(Request $request): array
    {
        $employee = $request->user()?->employee;
        $day = $employee ? DayState::find($employee) : null;
        $open = $day?->openSegment();

        return [
            'day' => $day ? AttendanceDayResource::make($day)->resolve($request) : null,
            'open_segment' => $open ? TimeSegmentResource::make($open)->resolve($request) : null,
            'policy' => AttendancePolicyResource::make(AttendancePolicy::current())->resolve($request),
            'server_time' => Fmt::dt(now()),
        ];
    }
}
