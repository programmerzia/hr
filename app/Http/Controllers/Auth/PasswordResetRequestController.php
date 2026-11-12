<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\PasswordResetRequest;
use App\Models\User;
use App\Notifications\PasswordResetNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class PasswordResetRequestController extends Controller
{
    public const NEUTRAL = 'If that account exists, management has been asked to reset it.';

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);
        $email = strtolower(trim($data['email']));

        $key = 'password-reset|'.$email.'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 3)) {
            throw ValidationException::withMessages(['email' => 'Too many requests. Try again in '.RateLimiter::availableIn($key).' seconds']);
        }
        RateLimiter::hit($key, 600);

        PasswordResetRequest::expireStale();
        $user = User::with('employee')->whereRaw('LOWER(email) = ?', [$email])->first();
        if ($user && $user->employee && ! PasswordResetRequest::where('user_id', $user->id)->where('status', 'pending')->exists()) {
            $req = PasswordResetRequest::create(['user_id' => $user->id, 'requested_at' => now(), 'ip' => $request->ip()]);
            $roles = in_array($user->role, ['hr', 'management'], true) ? ['management'] : ['management', 'hr'];
            $note = new PasswordResetNotification($req->id, $user->name.' asked for a password reset', $user->email);
            User::whereIn('role', $roles)->where('id', '!=', $user->id)->get()->each->notify($note);
        }

        return back()->with('success', self::NEUTRAL);
    }
}
