<?php

use Inertia\Testing\AssertableInertia as Assert;

$keys = ['overview', 'team_now', 'my_tasks', 'leave_balances', 'attention', 'payroll', 'billing', 'hiring', 'chat_unread'];

it('renders home with dashboard props for each role', function (string $role) use ($keys) {
    $user = makeUser($role);
    $this->actingAs($user)->get(route('home'))
        ->assertOk()
        ->assertInertia(function (Assert $page) use ($keys, $role) {
            $page->component('Home/HomePage');
            foreach ($keys as $k) {
                $page->has($k);
            }
            $page->where('overview.total', 1)->where('overview.counts.not_started', 1);
            if ($role === 'employee') {
                $page->where('payroll', null)->where('billing', null)->where('hiring', null)->where('attention', []);
            }
            if ($role === 'management') {
                $page->has('billing.aging')->has('hiring.data', 6);
            }
        });
})->with(['employee', 'team_lead', 'hr', 'management']);

it('shows the company in the overview to hr', function () {
    makeUser('employee');
    makeUser('employee');
    $this->actingAs(makeUser('hr'))->get(route('home'))
        ->assertInertia(fn (Assert $p) => $p->where('overview.title', 'Company today')->where('overview.total', 3));
});

it('lists a pending leave approval under attention for the lead', function () {
    $lead = makeUser('team_lead');
    $this->actingAs($lead)->get(route('home'))
        ->assertInertia(fn (Assert $p) => $p->where('attention', []));
});
