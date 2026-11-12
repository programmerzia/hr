<?php

use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\OnboardingChecklistItem;
use App\Models\SalaryStructure;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 5)));

function onboardPayload(array $over = []): array
{
    return [
        'name' => 'Maya Rahman', 'email' => 'maya@vivacom.example', 'phone' => '+8801711111111', 'nid' => '1234567890123',
        'department_id' => Department::factory()->create()->id, 'team_id' => null,
        'designation' => 'Software engineer', 'employment_type' => 'full_time', 'role' => 'employee',
        'joined_on' => '2026-11-12', 'probation_until' => null,
        'salary' => ['effective_from' => '2026-11-12', 'basic' => '55000', 'house_rent' => '25000', 'medical' => '10000', 'conveyance' => '10000', 'pf_percent' => '5', 'tax_monthly' => '0'],
        'bank' => ['bank' => 'BRAC Bank', 'branch' => 'Banani', 'account_name' => 'Maya Rahman', 'account_no' => '1234567890', 'routing_no' => '060261579'],
        'checklist' => ['Laptop issued', 'Policy acknowledgement signed'],
        ...$over,
    ];
}

it('onboards a person who signs in with the temporary password and must change it', function () {
    $hr = makeUser('hr');
    $res = $this->actingAs($hr)->post(route('people.store'), onboardPayload());
    $employee = Employee::where('email', 'maya@vivacom.example')->firstOrFail();
    $res->assertRedirect(route('people.profile', $employee))->assertSessionHas('credentials.temporary_password', 'welcome123');
    expect($employee->code)->toStartWith('VIV-')
        ->and(SalaryStructure::where('employee_id', $employee->id)->value('gross'))->toBe(100000)
        ->and($employee->status)->toBe('active');
    $this->assertDatabaseCount('onboarding_checklist_items', 2);

    auth()->logout();
    $this->post(route('login.store'), ['email' => 'maya@vivacom.example', 'password' => 'welcome123'])->assertRedirect();
    $this->assertAuthenticated();
    expect(User::where('email', 'maya@vivacom.example')->value('must_change_password'))->toBeTruthy();
    $this->get(route('people.directory'))->assertRedirect(route('account.password'));
});

it('validates onboarding with the mock messages', function () {
    $hr = makeUser('hr');
    $taken = makeUser();
    $this->actingAs($hr)->post(route('people.store'), onboardPayload(['email' => $taken->email, 'nid' => '12', 'name' => '']))
        ->assertSessionHasErrors(['email' => 'Someone with this email already exists', 'nid' => 'Enter 10 to 17 digits', 'name' => 'Required']);
});

it('forbids an employee from onboarding', function () {
    $this->actingAs(makeUser())->post(route('people.store'), onboardPayload())->assertForbidden();
    $this->actingAs(makeUser())->get(route('people.onboard'))->assertForbidden();
});

it('renders the directory for everyone with names and no private fields', function () {
    $emp = makeUser();
    makeUser('hr');
    $this->actingAs($emp)->get(route('people.directory'))->assertInertia(
        fn (Assert $p) => $p->component('People/DirectoryPage', false)->has('employees', 2)->where('employees.0.nid', '')->has('departments')->has('teams')->has('filters'),
    );
});

it('hides salary and bank from a lead and denies a peer the profile', function () {
    $lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $lead->employee->update(['team_id' => $team->id]);
    $member = makeUser('employee', ['team_id' => $team->id]);
    $peer = makeUser();
    $hr = makeUser('hr');
    SalaryStructure::create(['employee_id' => $member->employee_id, 'effective_from' => '2025-01-01', 'basic' => 50000, 'house_rent' => 0, 'medical' => 0, 'conveyance' => 0, 'pf_percent' => 0, 'tax_monthly' => 0, 'gross' => 50000, 'hourly_rate' => 284]);

    $this->actingAs($peer)->get(route('people.profile', $member->employee))->assertForbidden();
    $this->actingAs($lead)->get(route('people.profile', $member->employee))->assertInertia(
        fn (Assert $p) => $p->component('People/ProfilePage', false)->where('salary', null)->where('bank', null)->where('lead.id', $lead->employee_id),
    );
    $this->actingAs($member)->get(route('people.profile', $member->employee))->assertInertia(fn (Assert $p) => $p->has('salary', 1));
    $this->actingAs($hr)->get(route('people.profile', $member->employee))->assertInertia(fn (Assert $p) => $p->has('salary', 1)->has('user'));
});

it('resets a password to the temporary one and forces a change', function () {
    $hr = makeUser('hr');
    $target = makeUser();
    $this->actingAs($hr)->post(route('people.reset-password', $target->employee))
        ->assertSessionHas('credentials', ['email' => $target->email, 'temporary_password' => 'welcome123', 'context' => 'reset']);
    expect(User::find($target->id)->must_change_password)->toBeTrue();
    $this->actingAs($target)->post(route('people.reset-password', $hr->employee))->assertForbidden();
});

it('adds a salary structure only after the current one', function () {
    $hr = makeUser('hr');
    $emp = makeUser();
    $row = ['effective_from' => '2026-12-01', 'basic' => '40000', 'house_rent' => '1', 'medical' => '1', 'conveyance' => '1', 'pf_percent' => '0', 'tax_monthly' => '0'];
    $this->actingAs($hr)->post(route('people.salary', $emp->employee), $row)->assertSessionHasNoErrors();
    expect(SalaryStructure::where('employee_id', $emp->employee_id)->value('gross'))->toBe(40003);
    $this->actingAs($hr)->post(route('people.salary', $emp->employee), $row)->assertSessionHasErrors(['effective_from' => 'Effective date must be after the current structure']);
});

it('changes status, edits, toggles the checklist and adds an asset', function () {
    $hr = makeUser('hr');
    $emp = makeUser();
    $this->actingAs($hr)->post(route('people.status', $emp->employee), ['status' => 'active', 'effective_on' => '2026-11-12'])
        ->assertSessionHasErrors(['effective_on' => 'Already in this status']);
    $this->post(route('people.status', $emp->employee), ['status' => 'resigned', 'effective_on' => '2026-11-12'])->assertSessionHasNoErrors();
    expect($emp->employee->fresh()->exited_on->toDateString())->toBe('2026-11-12');

    $this->patch(route('people.update', $emp->employee), ['name' => 'New Name', 'designation' => 'Lead', 'email' => $emp->email, 'phone' => '1'])->assertSessionHasNoErrors();
    expect(User::find($emp->id)->name)->toBe('New Name');

    $this->post(route('people.assets', $emp->employee), ['name' => 'Laptop', 'tag' => 'LT-1', 'assigned_on' => '2026-11-12'])->assertSessionHasNoErrors();
    $this->post(route('people.assets', $emp->employee), ['name' => '', 'tag' => 'x', 'assigned_on' => '2026-11-12'])->assertSessionHasErrors(['name' => 'Required']);

    $item = OnboardingChecklistItem::create(['employee_id' => $emp->employee_id, 'label' => 'Laptop issued']);
    $this->patch(route('people.checklist.toggle', $item))->assertRedirect();
    expect($item->fresh()->done)->toBeTrue();
});

it('stores an uploaded document privately', function () {
    Storage::fake('local');
    $hr = makeUser('hr');
    $emp = makeUser();
    $this->actingAs($hr)->post(route('people.documents', $emp->employee), ['kind' => 'nid', 'file' => UploadedFile::fake()->create('nid.pdf', 20)])->assertSessionHasNoErrors();
    $doc = EmployeeDocument::firstOrFail();
    Storage::disk('local')->assertExists($doc->path);
    expect($doc->name)->toBe('nid.pdf');
});

it('gives the onboarding form the active people so it can warn about a duplicate name', function () {
    $hr = makeUser('hr');
    $this->actingAs($hr)->post(route('people.store'), onboardPayload());
    $this->get(route('people.onboard'))->assertInertia(fn ($page) => $page->component('People/OnboardPage')
        ->where('existing', fn ($rows) => collect($rows)->contains(fn ($r) => $r['name'] === 'Maya Rahman' && $r['email'] === 'maya@vivacom.example')));
});
