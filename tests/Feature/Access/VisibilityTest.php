<?php

use App\Domain\Attendance\Services\Scope;
use App\Domain\Leave\Services\LeaveNotifier;
use App\Models\LeaveRequest;
use App\Models\Team;
use App\Support\Access;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

function teamIds($test, $user): array
{
    $ids = [];
    $test->actingAs($user)->get(route('attendance.team'))->assertOk()->assertInertia(function (Assert $p) use (&$ids) {
        $ids = collect($p->toArray()['props']['members'])->pluck('employee.id')->sort()->values()->all();
    });

    return $ids;
}

it('lets an employee-role user with view_company see the company-wide team page', function () {
    $a = makeUser('employee');
    $b = makeUser('employee');
    $viewer = makeUser('employee');
    $viewer->givePermissionTo(['view_team', 'view_company']);
    expect(teamIds($this, $viewer))->toBe(collect([$a->employee_id, $b->employee_id, $viewer->employee_id])->sort()->values()->all());
});

it('shows a lead their team and unassigned people, but not HR staff without a team', function () {
    $lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $lead->employee->update(['team_id' => $team->id]);
    $mate = makeUser('employee');
    $mate->employee->update(['team_id' => $team->id]);
    $unassigned = makeUser('employee');
    $hr = makeUser('hr');
    $elsewhere = makeUser('employee');
    $elsewhere->employee->update(['team_id' => Team::factory()->create()->id]);

    expect(teamIds($this, $lead))->toBe(collect([$lead->employee_id, $mate->employee_id, $unassigned->employee_id])->sort()->values()->all())
        ->and(Scope::canSee($lead, $hr->employee))->toBeFalse()
        ->and(Scope::canSee($lead, $unassigned->employee))->toBeTrue()
        ->and(Scope::canSee($lead, $elsewhere->employee))->toBeFalse();
});

it('does not crash for a team_lead-role user who leads nobody and shows unassigned people', function () {
    $lead = makeUser('team_lead');
    $unassigned = makeUser('employee');
    $inTeam = makeUser('employee');
    $inTeam->employee->update(['team_id' => Team::factory()->create()->id]);

    expect(teamIds($this, $lead))->toBe(collect([$lead->employee_id, $unassigned->employee_id])->sort()->values()->all());
    $this->actingAs($lead)->get(route('attendance.team.history'))->assertOk();
    $this->actingAs($lead)->get(route('leave.calendar'))->assertOk();
});

it('shows only themselves to an hr user whose view_company is revoked', function () {
    $other = makeUser('employee');
    $other->employee->update(['team_id' => Team::factory()->create()->id]);
    $hr = makeUser('hr');
    $hr->employee->update(['team_id' => Team::factory()->create()->id]);
    expect(count(teamIds($this, $hr)))->toBeGreaterThan(1);

    Role::findByName('hr', 'web')->revokePermissionTo('view_company');
    Access::flush();
    expect(teamIds($this, $hr->fresh()))->toBe([$hr->employee_id]);
});

it('falls back to manage_access holders for leave when nobody holds approve_leave_hr', function () {
    $admin = makeUser('employee');
    $admin->givePermissionTo('manage_access');
    $requester = makeUser('employee');
    $r = new LeaveRequest(['employee_id' => $requester->employee_id]);
    expect(LeaveNotifier::hrDeciders($r)->pluck('id')->all())->toBe([$admin->id]);
});

it('access:sync grants a new permission to default roles once and never strips customised grants', function () {
    $hr = Role::findByName('hr', 'web');
    $hr->givePermissionTo(['approve_claims', 'approve_payroll']);
    $hr->revokePermissionTo('view_company');
    Permission::where('name', 'view_company')->delete();
    Access::flush();

    $this->artisan('access:sync')->assertSuccessful();
    expect($hr->fresh()->hasPermissionTo('view_company'))->toBeTrue();

    // An admin removes it again: a second sync must not put it back or touch other grants.
    $hr->revokePermissionTo('view_company');
    Access::flush();
    $this->artisan('access:sync')->assertSuccessful();
    $this->artisan('access:sync')->assertSuccessful();
    $hr = $hr->fresh();
    expect($hr->hasPermissionTo('view_company'))->toBeFalse()
        ->and($hr->hasPermissionTo('approve_claims'))->toBeTrue()
        ->and($hr->hasPermissionTo('approve_payroll'))->toBeTrue()
        ->and(Role::findByName('employee', 'web')->hasPermissionTo('view_company'))->toBeFalse();
});
