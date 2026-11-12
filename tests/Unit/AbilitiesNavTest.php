<?php

use App\Models\Employee;
use App\Models\User;
use App\Support\Abilities;
use App\Support\Nav;

it('maps roles to abilities like permissions.ts', function () {
    expect(Abilities::for(new User(['role' => 'employee'])))->toBe([])
        ->and(Abilities::for(new User(['role' => 'management'])))->toHaveCount(12)
        ->and(Abilities::for(new User(['role' => 'hr'])))->toBe(['view_team', 'approve_leave_hr', 'manage_people', 'manage_payroll', 'manage_settings', 'manage_policy']);
});

it('shows claims to a contractor and payslips to full time staff', function () {
    $u = new User(['role' => 'employee']);
    $u->setRelation('employee', new Employee(['employment_type' => 'contractor']));
    $ids = collect(Nav::for($u))->flatMap(fn ($g) => array_column($g['items'], 'id'))->all();
    expect($ids)->toContain('my-claims')->not->toContain('payslips')->not->toContain('team');
});
