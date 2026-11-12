<?php

namespace App\Http\Controllers\People;

use App\Domain\People\Actions\ResetPassword;
use App\Http\Controllers\Controller;
use App\Models\ActivityLogEntry;
use App\Models\PasswordResetRequest;
use App\Notifications\PasswordResetNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class PasswordResetController extends Controller
{
    public function approve(Request $request, PasswordResetRequest $passwordReset, ResetPassword $reset): RedirectResponse
    {
        PasswordResetRequest::expireStale();
        $passwordReset->refresh();
        abort_unless($passwordReset->decidableBy($request->user()), 403);

        $employee = $passwordReset->user->employee;
        $temp = $reset($employee);
        $this->close($request, $passwordReset, 'approved', null, 'Password reset approved for '.$employee->name);

        return back()->with('credentials', ['email' => $employee->email, 'temporary_password' => $temp, 'context' => 'reset']);
    }

    public function reject(Request $request, PasswordResetRequest $passwordReset): RedirectResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:255']]);
        PasswordResetRequest::expireStale();
        $passwordReset->refresh();
        abort_unless($passwordReset->decidableBy($request->user()), 403);

        $this->close($request, $passwordReset, 'rejected', $data['note'] ?? null, 'Password reset rejected for '.$passwordReset->user->name);

        return back()->with('success', 'Request rejected');
    }

    private function close(Request $request, PasswordResetRequest $req, string $status, ?string $note, string $text): void
    {
        $actor = $request->user()->employee_id;
        $req->update(['status' => $status, 'decided_by' => $actor, 'decided_at' => now(), 'note' => $note]);
        ActivityLogEntry::create([
            'subject_type' => 'employee',
            'subject_id' => $req->user->employee_id,
            'actor_id' => $actor,
            'description' => $text,
            'properties' => ['kind' => 'password_reset_'.$status, 'effective_on' => now()->toDateString()],
        ]);
        DatabaseNotification::where('type', PasswordResetNotification::class)
            ->where('data', 'like', '%'.$req->id.'%')->whereNull('read_at')->update(['read_at' => now()]);
    }
}
