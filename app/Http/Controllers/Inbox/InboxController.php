<?php

namespace App\Http\Controllers\Inbox;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InboxController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Inbox/InboxPage', [
            'notifications' => NotificationResource::collection($user->notifications()->latest()->limit(100)->get())->resolve(),
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
