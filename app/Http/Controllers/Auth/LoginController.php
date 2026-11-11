<?php

namespace App\Http\Controllers\Auth;

use App\Domain\Attendance\Actions\EndDay;
use App\Domain\Attendance\Actions\StartBreak;
use App\Domain\Attendance\Actions\StartWork;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public function create(): Response
    {
        $demo = app()->environment(['local', 'development', 'dev', 'testing'])
            ? User::query()->where('must_change_password', false)->orderByRaw("FIELD(role, 'management', 'hr', 'team_lead', 'employee')")->orderBy('name')
                ->get(['name', 'email', 'role'])->map->only(['name', 'email', 'role'])->values()
            : [];

        return Inertia::render('Auth/LoginPage', ['demo_accounts' => $demo]);
    }

    public function store(Request $request, StartWork $startWork): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'confirm_overtime' => ['sometimes', 'boolean'],
        ]);

        $user = User::with('employee')->whereRaw('LOWER(email) = ?', [strtolower(trim($data['email']))])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Email or password is incorrect']);
        }
        $employee = $user->employee;
        if (! $employee || ! in_array($employee->status, ['active', 'probation', 'on_leave'], true)) {
            throw ValidationException::withMessages(['email' => 'This account cannot sign in']);
        }

        $result = $startWork($employee, (bool) ($data['confirm_overtime'] ?? false));
        if ($result === StartWork::NEEDS_OVERTIME_CONFIRM) {
            return back()->withErrors(['needs_overtime_confirm' => 'You ended your day already. Start an overtime session?'])
                ->withInput($request->only('email'));
        }

        Auth::login($user, true);
        $request->session()->regenerate();
        $user->forceFill(['last_seen_at' => now()])->save();

        return redirect()->intended(route('home'));
    }

    public function destroy(Request $request, StartBreak $startBreak, EndDay $endDay): RedirectResponse
    {
        $data = $request->validate([
            'mode' => ['required', Rule::in(['break', 'end_day'])],
            'break_category' => ['nullable', Rule::in(['short', 'tea', 'lunch', 'official', 'signed_out'])],
            'note' => ['nullable', 'string', 'max:255'],
        ]);
        $employee = $request->user()->employee;
        if ($employee) {
            if ($data['mode'] === 'break') {
                $startBreak($employee, $data['break_category'] ?? 'signed_out', $data['note'] ?? null);
            } else {
                $endDay($employee);
            }
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
