<?php

use App\Notifications\LeaveRequestNotification;
use App\Support\Badges;
use Inertia\Testing\AssertableInertia as Assert;

it('lists only my notifications', function () {
    $me = makeUser();
    $other = makeUser();
    $me->notify(new LeaveRequestNotification('Mine', 'body', '/leave'));
    $other->notify(new LeaveRequestNotification('Theirs', null, '/leave'));

    $this->actingAs($me)->get(route('inbox'))->assertOk()
        ->assertInertia(fn (Assert $p) => $p->component('Inbox/InboxPage')
            ->has('notifications', 1)->where('notifications.0.title', 'Mine')->where('unread', 1));
});

it('marks one read and all read, and drives the badge', function () {
    $me = makeUser();
    $me->notify(new LeaveRequestNotification('A', null, '/leave'));
    $me->notify(new LeaveRequestNotification('B', null, '/leave'));
    $id = $me->notifications()->first()->id;

    $this->actingAs($me)->post(route('inbox.read'), ['id' => $id])->assertRedirect();
    expect($me->unreadNotifications()->count())->toBe(1);
    expect(Badges::for($me)['inbox'])->toBe(1);

    $this->actingAs($me)->post(route('inbox.read-all'))->assertRedirect();
    expect($me->unreadNotifications()->count())->toBe(0);
});

it('cannot mark someone elses notification read', function () {
    $me = makeUser();
    $other = makeUser();
    $other->notify(new LeaveRequestNotification('Theirs', null, '/leave'));
    $this->actingAs($me)->post(route('inbox.read'), ['id' => $other->notifications()->first()->id])->assertRedirect();
    expect($other->unreadNotifications()->count())->toBe(1);
});

it('renders the chat preview and restricts settings', function () {
    $this->actingAs(makeUser())->get(route('chat'))->assertOk()
        ->assertInertia(fn (Assert $p) => $p->component('Chat/ChatPage')->where('conversations', [])->where('messages', []));
    $this->actingAs(makeUser())->get(route('settings'))->assertForbidden();
    $this->actingAs(makeUser('hr'))->get(route('settings'))->assertOk()
        ->assertInertia(fn (Assert $p) => $p->component('Settings/SettingsPage'));
});
