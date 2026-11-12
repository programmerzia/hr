<?php

use App\Models\ActivityLogEntry;
use App\Models\User;
use App\Support\Access;
use App\Support\Nav;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

function navIds(User $u): array
{
    return collect(Nav::for($u->fresh('employee')))->flatMap(fn ($g) => array_column($g['items'], 'id'))->all();
}

it('guards each module route by permission', function (string $route, string $permission, string $without, string $with) {
    $this->actingAs(makeUser($without))->get(route($route))->assertForbidden()
        ->assertInertia(fn (Assert $p) => $p->component('Errors/Forbidden', false));
    $this->actingAs(makeUser($with))->get(route($route))->assertOk();
})->with([
    'team' => ['attendance.team', 'view_team', 'employee', 'team_lead'],
    'team history' => ['attendance.team.history', 'view_team', 'employee', 'hr'],
    'onboard' => ['people.onboard', 'manage_people', 'team_lead', 'hr'],
    'clients' => ['billing.clients', 'manage_billing', 'hr', 'management'],
    'invoices' => ['billing.invoices', 'manage_billing', 'team_lead', 'management'],
    'reports' => ['reports.index', 'view_reports', 'team_lead', 'hr'],
    'settings' => ['settings', 'manage_policy', 'team_lead', 'hr'],
    'access' => ['settings.access.index', 'manage_access', 'hr', 'management'],
]);

it('keeps the people directory open to everyone', function () {
    $this->actingAs(makeUser('employee'))->get(route('people.directory'))->assertOk();
});

it('follows a revoked permission in routes, nav and shared abilities', function () {
    $hr = makeUser('hr');
    expect(navIds($hr))->toContain('reports');
    Role::findByName('hr')->revokePermissionTo('view_reports');
    Access::flush();
    $hr = $hr->fresh();
    expect(navIds($hr))->not->toContain('reports');
    $this->actingAs($hr)->get(route('reports.index'))->assertForbidden();
    $this->actingAs($hr)->get(route('home'))->assertInertia(fn (Assert $p) => $p->where('auth.abilities', fn ($a) => ! collect($a)->contains('view_reports')));
});

it('grants a permission through a direct override', function () {
    $u = makeUser('employee');
    $this->actingAs(makeUser('management'))->put(route('settings.access.users.permissions', $u->id), ['permissions' => ['view_reports']])->assertSessionHas('success');
    expect(navIds($u))->toContain('reports');
    $this->actingAs($u->fresh())->get(route('reports.index'))->assertOk();
});

it('shows claims and payslips by employment type', function () {
    $c = makeUser('employee', ['employment_type' => 'contractor']);
    expect(navIds($c))->toContain('my-claims')->not->toContain('payslips')->not->toContain('team');
});

it('renders the access page props', function () {
    makeUser('hr');
    $this->actingAs(makeUser('management'))->get(route('settings.access.index'))->assertInertia(fn (Assert $p) => $p
        ->component('Settings/AccessPage', false)->has('roles', 5)->has('permissions', 14)->has('modules', 10)
        ->has('roles.0', fn (Assert $r) => $r->hasAll(['id', 'name', 'label', 'is_system', 'users_count', 'permissions']))
        ->has('users.0', fn (Assert $r) => $r->hasAll(['id', 'employee_id', 'name', 'email', 'role', 'direct_permissions'])));
});

it('saves the matrix for a role and logs it', function () {
    $m = makeUser('management');
    $role = Role::findByName('team_lead');
    $this->actingAs($m)->put(route('settings.access.roles.update', $role), ['permissions' => ['view_team', 'view_reports']])->assertSessionHas('success');
    expect($role->fresh()->permissions->pluck('name')->sort()->values()->all())->toBe(['view_reports', 'view_team'])
        ->and(ActivityLogEntry::where('subject_type', 'settings')->where('properties->area', 'access')->count())->toBe(1);
    $this->actingAs($m)->put(route('settings.access.roles.update', $role), ['permissions' => ['nope']])->assertSessionHasErrors('permissions.0');
});

it('never lets management lose manage_access', function () {
    $m = makeUser('management');
    $role = Role::findByName('management');
    $this->actingAs($m)->put(route('settings.access.roles.update', $role), ['permissions' => ['view_team']])->assertSessionHas('error');
    expect($role->fresh()->hasPermissionTo('manage_access'))->toBeTrue();
});

it('creates and deletes custom roles with the rules', function () {
    $m = makeUser('management');
    $this->actingAs($m)->post(route('settings.access.roles.store'), ['name' => 'Bad Name', 'label' => ''])->assertSessionHasErrors(['name', 'label']);
    $this->actingAs($m)->post(route('settings.access.roles.store'), ['name' => 'hr', 'label' => 'Dup'])->assertSessionHasErrors('name');
    $this->actingAs($m)->post(route('settings.access.roles.store'), ['name' => 'auditor', 'label' => 'Auditor'])->assertSessionHas('success');
    $role = Role::findByName('auditor');
    expect((bool) $role->is_system)->toBeFalse();

    $this->actingAs($m)->delete(route('settings.access.roles.destroy', Role::findByName('hr')))->assertSessionHas('error');
    expect(Role::where('name', 'hr')->exists())->toBeTrue();

    $u = makeUser('employee');
    $this->actingAs($m)->patch(route('people.role', $u->employee_id), ['role' => 'auditor'])->assertSessionHas('success');
    $this->actingAs($m)->delete(route('settings.access.roles.destroy', $role))->assertSessionHas('error');
    $this->actingAs($m)->patch(route('people.role', $u->employee_id), ['role' => 'employee']);
    $this->actingAs($m)->delete(route('settings.access.roles.destroy', $role))->assertSessionHas('success');
    expect(Role::where('name', 'auditor')->exists())->toBeFalse();
});

it('changes an employee role and mirrors users.role', function () {
    $m = makeUser('management');
    $u = makeUser('employee');
    $this->actingAs($m)->patch(route('people.role', $u->employee_id), ['role' => 'hr'])->assertSessionHas('success');
    $u = $u->fresh();
    expect($u->role)->toBe('hr')->and($u->getRoleNames()->all())->toBe(['hr'])->and($u->can('manage_people'))->toBeTrue();
    $this->actingAs($m)->patch(route('people.role', $u->employee_id), ['role' => 'ghost'])->assertSessionHasErrors('role');
    $this->actingAs(makeUser('hr'))->patch(route('people.role', $u->employee_id), ['role' => 'employee'])->assertForbidden();
});

it('refuses own role change and demoting the last manager', function () {
    $m = makeUser('management');
    $this->actingAs($m)->patch(route('people.role', $m->employee_id), ['role' => 'employee'])->assertSessionHas('error');
    expect($m->fresh()->role)->toBe('management');

    $other = makeUser('employee');
    $this->actingAs($m)->put(route('settings.access.users.permissions', $other->id), ['permissions' => ['manage_access']]);
    // $other holds manage_access only directly; $m is still a manager so removing it is allowed.
    $this->actingAs($m)->put(route('settings.access.users.permissions', $other->id), ['permissions' => []])->assertSessionHas('success');

    // Make $other the only remaining manager via a direct grant, then try to demote $m by the other path.
    $this->actingAs($m)->put(route('settings.access.users.permissions', $other->id), ['permissions' => ['manage_access']]);
    $this->actingAs($other->fresh())->patch(route('people.role', $m->employee_id), ['role' => 'employee'])->assertSessionHas('success');
    $this->actingAs($m->fresh())->get(route('settings.access.index'))->assertForbidden();
    $this->actingAs($other->fresh())->put(route('settings.access.users.permissions', $other->id), ['permissions' => []])->assertSessionHas('error');
    expect($other->fresh()->checkPermissionTo('manage_access'))->toBeTrue();
});

it('access:sync is idempotent and assigns missing roles', function () {
    $u = makeUser('team_lead');
    $u->roles()->detach();
    Access::flush();
    $this->artisan('access:sync')->assertSuccessful();
    $counts = [Role::count(), Permission::count()];
    expect($u->fresh()->getRoleNames()->all())->toBe(['team_lead']);
    $this->artisan('access:sync')->assertSuccessful();
    expect([Role::count(), Permission::count()])->toBe($counts)->toBe([5, 14]);
});
