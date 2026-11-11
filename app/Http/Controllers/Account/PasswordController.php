<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\UserResource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PasswordController extends Controller
{
    public const MIN_PASSWORD = 8;

    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Account/AccountPage', [
            'user' => UserResource::make($user)->resolve($request),
            'employee' => $user->employee ? EmployeeResource::make($user->employee)->resolve($request) : null,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'current' => ['required', 'string'],
            'next' => ['required', 'string'],
        ]);
        $user = $request->user();
        if (! Hash::check($data['current'], $user->password)) {
            throw ValidationException::withMessages(['current' => 'Current password is incorrect']);
        }
        if (strlen($data['next']) < self::MIN_PASSWORD) {
            throw ValidationException::withMessages(['next' => 'New password must be at least '.self::MIN_PASSWORD.' characters']);
        }
        if ($data['next'] === $data['current']) {
            throw ValidationException::withMessages(['next' => 'New password must differ from the current one']);
        }
        $user->forceFill(['password' => $data['next'], 'must_change_password' => false])->save();

        return redirect()->route('home')->with('success', 'Password changed');
    }
}
