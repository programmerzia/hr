<?php

namespace App\Http\Controllers\Inbox;

use App\Http\Controllers\Controller;
use App\Http\Resources\Fmt;
use App\Http\Resources\NotificationResource;
use App\Models\PasswordResetRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InboxController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        PasswordResetRequest::expireStale();
        $resets = in_array($user->role, ['hr', 'management'], true)
            ? PasswordResetRequest::with('user')->where('status', 'pending')->oldest('requested_at')->get()
                ->filter(fn ($r) => $r->decidableBy($user))
                ->map(fn ($r) => ['id' => $r->id, 'name' => $r->user->name, 'email' => $r->user->email, 'role' => $r->user->role, 'requested_at' => Fmt::dt($r->requested_at)])->values()
            : [];

        return Inertia::render('Inbox/InboxPage', [
            'notifications' => NotificationResource::collection($user->notifications()->latest()->limit(100)->get())->resolve(),
            'password_resets' => $resets,
            'credentials' => $request->session()->get('credentials'),
            'unread' => $user->unreadNotifications()->count(),
        ]);
    }

    public function read(Request $request): RedirectResponse
    {
        $data = $request->validate(['id' => ['required', 'string']]);
        $request->user()->notifications()->whereKey($data['id'])->first()?->markAsRead();

        return back();
    }

    public function readAll(Request $request): RedirectResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return back()->with('success', 'All caught up');
    }
}
