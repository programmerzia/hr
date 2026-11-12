<?php

use App\Models\PasswordResetRequest;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 40));
});

const NEUTRAL = 'If that account exists, management has been asked to reset it.';

it('creates a request and notifies management and hr but not the requester', function () {
    $mgmt = makeUser('management');
    $hr = makeUser('hr');
    $emp = makeUser();
    $this->post(route('password.request'), ['email' => $emp->email])->assertSessionHas('success', NEUTRAL);
    expect(PasswordResetRequest::where('user_id', $emp->id)->where('status', 'pending')->count())->toBe(1);
    expect($mgmt->notifications()->count())->toBe(1)
        ->and($hr->notifications()->count())->toBe(1)
        ->and($emp->notifications()->count())->toBe(0);
});

it('notifies only management for an hr requester', function () {
    $mgmt = makeUser('management');
    $hr = makeUser('hr');
    $hr2 = makeUser('hr');
    $this->post(route('password.request'), ['email' => $hr->email]);
    expect($mgmt->notifications()->count())->toBe(1)->and($hr2->notifications()->count())->toBe(0);
});

it('answers an unknown email identically and creates nothing', function () {
    makeUser('management');
    $this->post(route('password.request'), ['email' => 'nobody@example.com'])->assertSessionHas('success', NEUTRAL);
    expect(PasswordResetRequest::count())->toBe(0);
});

it('throttles after three requests', function () {
    $emp = makeUser();
    foreach (range(1, 3) as $i) {
        $this->post(route('password.request'), ['email' => $emp->email])->assertSessionHasNoErrors();
    }
    $this->post(route('password.request'), ['email' => $emp->email])->assertSessionHasErrors('email');
});

it('does not duplicate a pending request', function () {
    makeUser('management');
    $emp = makeUser();
    $this->post(route('password.request'), ['email' => $emp->email]);
    $this->post(route('password.request'), ['email' => $emp->email]);
    expect(PasswordResetRequest::count())->toBe(1);
});

it('lets management approve; the temp password works and must be changed', function () {
    $mgmt = makeUser('management');
    $emp = makeUser();
    $this->post(route('password.request'), ['email' => $emp->email]);
    $req = PasswordResetRequest::first();
    $this->actingAs($mgmt)->post(route('people.password-resets.approve', $req))
        ->assertSessionHas('credentials.temporary_password', 'welcome123');
    expect($req->fresh()->status)->toBe('approved')->and($req->fresh()->decided_by)->toBe($mgmt->employee_id);
    expect($emp->fresh()->must_change_password)->toBeTrue();
    expect($mgmt->unreadNotifications()->count())->toBe(0);
    $this->post(route('logout'));
    auth()->logout();
    $this->post(route('login.store'), ['email' => $emp->email, 'password' => 'welcome123'])->assertRedirect();
    $this->assertAuthenticatedAs($emp);
});

it('forbids hr from approving hr or management requests but allows employees', function () {
    $hr = makeUser('hr');
    $other = makeUser('hr');
    $mgmt = makeUser('management');
    $emp = makeUser();
    foreach ([$other, $mgmt, $emp] as $u) {
        $this->post(route('password.request'), ['email' => $u->email]);
    }
    $byUser = fn ($u) => PasswordResetRequest::where('user_id', $u->id)->first();
    $this->actingAs($hr)->post(route('people.password-resets.approve', $byUser($other)))->assertForbidden();
    $this->actingAs($hr)->post(route('people.password-resets.approve', $byUser($mgmt)))->assertForbidden();
    $this->actingAs($hr)->post(route('people.password-resets.approve', $byUser($emp)))->assertSessionHas('credentials');
});

it('rejects with a note', function () {
    $mgmt = makeUser('management');
    $emp = makeUser();
    $this->post(route('password.request'), ['email' => $emp->email]);
    $req = PasswordResetRequest::first();
    $this->actingAs($mgmt)->post(route('people.password-resets.reject', $req), ['note' => 'Call me'])->assertSessionHas('success');
    expect($req->fresh()->status)->toBe('rejected')->and($req->fresh()->note)->toBe('Call me');
    expect(password_verify('welcome123', $emp->fresh()->password))->toBeFalse();
});

it('expires a pending request after 48 hours on the next request', function () {
    makeUser('management');
    $emp = makeUser();
    $this->post(route('password.request'), ['email' => $emp->email]);
    $old = PasswordResetRequest::first();
    $this->travel(49)->hours();
    $this->post(route('password.request'), ['email' => $emp->email]);
    expect($old->fresh()->status)->toBe('expired')->and(PasswordResetRequest::where('status', 'pending')->count())->toBe(1);
});

it('shows pending requests in the inbox with a badge', function () {
    $mgmt = makeUser('management');
    $emp = makeUser();
    $this->post(route('password.request'), ['email' => $emp->email]);
    $this->actingAs($mgmt)->get(route('inbox'))->assertInertia(fn (Assert $p) => $p->component('Inbox/InboxPage', false)
        ->has('password_resets', 1)->where('unread', 1)->where('badges.inbox', 1));
    $this->actingAs($emp)->get(route('inbox'))->assertInertia(fn (Assert $p) => $p->has('password_resets', 0));
});
