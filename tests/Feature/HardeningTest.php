<?php

use App\Domain\Attendance\Services\DayState;
use App\Domain\Leave\Actions\ApproveAsHr;
use App\Domain\Leave\Actions\ApproveAsLead;
use App\Domain\Leave\Actions\Reject;
use App\Domain\Payroll\Actions\DraftRun;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\Invoice;
use App\Models\LeaveRequest;
use App\Models\PayrollRun;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Database\Seeders\ProductionSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

function hardOnboard(array $over = []): array
{
    return [
        'name' => 'New Person', 'email' => 'new@vivacom.example', 'phone' => '+8801711111111', 'nid' => '1234567890123',
        'department_id' => Department::factory()->create()->id, 'designation' => 'Engineer', 'employment_type' => 'full_time',
        'role' => 'employee', 'joined_on' => '2026-11-12', ...$over,
    ];
}

it('stops HR creating management users but lets management do it', function () {
    $this->actingAs(makeUser('hr'))->post(route('people.store'), hardOnboard(['role' => 'management']))->assertSessionHasErrors('role');
    expect(User::where('email', 'new@vivacom.example')->exists())->toBeFalse();

    $this->actingAs(makeUser('management'))->post(route('people.store'), hardOnboard(['role' => 'management']))->assertSessionDoesntHaveErrors();
    expect(User::where('email', 'new@vivacom.example')->value('role'))->toBe('management');
});

it('keeps management accounts out of HR reach for reset and edit, and blocks self reset', function () {
    $hr = makeUser('hr');
    $boss = makeUser('management');
    $this->actingAs($hr)->post(route('people.reset-password', $boss->employee))->assertForbidden();
    $this->actingAs($hr)->patch(route('people.update', $boss->employee), ['name' => 'X', 'designation' => 'Y', 'email' => 'x@vivacom.example'])->assertForbidden();
    $this->actingAs($hr)->post(route('people.reset-password', $hr->employee))->assertForbidden();
    $this->actingAs($boss)->post(route('people.reset-password', $hr->employee))->assertSessionHas('credentials');
    $this->actingAs($hr)->post(route('people.reset-password', makeUser()->employee))->assertSessionHas('credentials');
});

it('throttles failed sign-in attempts to five a minute per email and IP', function () {
    $user = makeUser();
    for ($i = 0; $i < 5; $i++) {
        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'wrong'])->assertSessionHasErrors(['email' => 'Email or password is incorrect']);
    }
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertSessionHasErrors('email');
    $this->assertGuest();
});

it('does not throttle repeated successful sign-ins', function () {
    $user = makeUser();
    for ($i = 0; $i < 7; $i++) {
        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertRedirect();
        $this->post(route('logout'), ['mode' => 'break']);
    }
    $this->assertGuest();
});

it('restricts deleting parents of money rows (MySQL)', function () {
    if (DB::getDriverName() === 'sqlite') {
        $this->markTestSkipped('SQLite cannot alter foreign keys; enforced on MySQL only');
    }
    $invoice = Invoice::factory()->create();
    expect(fn () => DB::table('clients')->where('id', $invoice->client_id)->delete())->toThrow(QueryException::class);
});

it('rejects an unknown or invisible current task', function () {
    $emp = makeUser();
    $this->actingAs($emp)->post(route('attendance.current-task'), ['task_id' => (string) Str::uuid()])->assertSessionHasErrors('task_id');

    $task = Task::factory()->create(['project_id' => Project::factory()->create()->id]);
    $this->actingAs($emp)->post(route('attendance.current-task'), ['task_id' => $task->id])->assertForbidden();
    expect($emp->employee->fresh()->current_task_id)->toBeNull();
});

it('numbers invoices from a locked counter that continues from the existing maximum', function () {
    $mgmt = makeUser('management');
    Invoice::factory()->create(['number' => 'VIV-2026-0007', 'status' => 'sent']);
    $a = Invoice::factory()->create(['number' => 'DRAFT-A', 'due_on' => '2027-01-01']);
    $b = Invoice::factory()->create(['number' => 'DRAFT-B', 'due_on' => '2027-01-01']);
    $this->actingAs($mgmt)->post(route('billing.invoices.send', $a));
    $this->actingAs($mgmt)->post(route('billing.invoices.send', $b));
    expect($a->fresh()->number)->toBe('VIV-2026-0008')->and($b->fresh()->number)->toBe('VIV-2026-0009')
        ->and(DB::table('invoice_counters')->where('year', 2026)->value('last'))->toBe(9);
});

it('creates today once and refuses a second payroll run for the month', function () {
    $emp = makeUser()->employee;
    $a = DB::transaction(fn () => DayState::ensureToday($emp));
    $b = DB::transaction(fn () => DayState::ensureToday($emp));
    expect($a->id)->toBe($b->id)->and($emp->attendanceDays()->count())->toBe(1);

    $hr = makeUser('hr')->employee;
    app(DraftRun::class)(2026, 11, $hr);
    expect(fn () => app(DraftRun::class)(2026, 11, $hr))->toThrow(ValidationException::class);
    expect(PayrollRun::where('year', 2026)->where('month', 11)->count())->toBe(1);
});

it('never lets anyone decide their own or a settled leave request', function () {
    $hr = makeUser('hr');
    $mine = LeaveRequest::factory()->create(['employee_id' => $hr->employee_id, 'status' => 'pending_hr']);
    $this->actingAs($hr)->post(route('leave.reject', $mine), ['note' => 'no'])->assertForbidden();
    expect(fn () => app(ApproveAsHr::class)($mine, $hr->employee))->toThrow(ValidationException::class)
        ->and(fn () => app(Reject::class)($mine, $hr->employee, 'no'))->toThrow(ValidationException::class)
        ->and(fn () => app(ApproveAsLead::class)($mine->forceFill(['status' => 'pending_lead']), $hr->employee))->toThrow(ValidationException::class);

    $done = LeaveRequest::factory()->create(['status' => 'approved']);
    expect($hr->can('decide', $done))->toBeFalse();
});

it('seeds the first HR account from config with the next free code', function () {
    config(['vivacom.seed_admin_email' => 'boss@vivacom.example', 'vivacom.seed_admin_password' => 'a-long-secret', 'vivacom.seed_admin_name' => 'Boss']);
    Employee::factory()->create(['code' => 'VIV-140']);
    $this->seed(ProductionSeeder::class);
    expect(Employee::where('email', 'boss@vivacom.example')->value('code'))->toBe('VIV-141')
        ->and(User::where('email', 'boss@vivacom.example')->value('role'))->toBe('hr');
});

it('streams a document only to people who can see the pay tab', function () {
    Storage::fake('local');
    $owner = makeUser();
    Storage::disk('local')->put('documents/a.pdf', 'pdf');
    $doc = EmployeeDocument::create(['employee_id' => $owner->employee_id, 'kind' => 'contract', 'name' => 'a.pdf', 'path' => 'documents/a.pdf', 'uploaded_at' => now()]);
    $this->actingAs($owner)->get(route('people.documents.download', [$owner->employee, $doc]))->assertOk()->assertDownload('a.pdf');
    $this->actingAs(makeUser())->get(route('people.documents.download', [$owner->employee, $doc]))->assertForbidden();
});

it('only lets a lead or manager reassign a project lead, and only to an active employee', function () {
    $lead = makeUser('team_lead');
    $project = Project::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $gone = Employee::factory()->create(['status' => 'terminated']);
    $this->actingAs($lead)->patch(route('work.projects.update', $project), ['lead_employee_id' => $gone->id])->assertSessionHasErrors('lead_employee_id');
    $this->actingAs(makeUser())->patch(route('work.projects.update', $project), ['lead_employee_id' => $lead->employee_id])->assertForbidden();
});
