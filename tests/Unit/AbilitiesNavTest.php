<?php

use App\Support\Access;

it('seeds system roles from the abilities table plus manage_access for management', function () {
    expect(Access::defaultsFor('employee'))->toBe([])
        ->and(Access::defaultsFor('management'))->toHaveCount(14)->toContain('manage_access')
        ->and(Access::defaultsFor('hr'))->toBe(['view_team', 'approve_leave_hr', 'manage_people', 'manage_payroll', 'manage_settings', 'manage_policy', 'view_reports']);
});
