<?php

use App\Domain\Leave\Actions\ApproveAsLead;
use App\Domain\Leave\Support\Trail;
use App\Http\Requests\People\BankRules;
use App\Models\ActivityLogEntry;
use App\Models\Department;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Team;
use App\Support\Audit;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 18)->setTime(10, 0));
    $this->type = LeaveType::create(['name' => 'Casual leave', 'annual_quota' => 10, 'is_paid' => true, 'carry_forward' => false, 'allows_half_day' => true]);
    $this->lead = makeUser('team_lead');
    $this->hr = makeUser('hr');
    $this->emp = makeUser('employee');
    $team = Team::create(['name' => 'Web', 'department_id' => Department::create(['name' => 'Eng'])->id, 'lead_employee_id' => $this->lead->employee_id]);
    $this->emp->employee->update(['team_id' => $team->id]);
    LeaveBalance::create(['employee_id' => $this->emp->employee_id, 'leave_type_id' => $this->type->id, 'year' => 2026, 'entitled' => 10, 'used' => 0, 'pending' => 0]);
});

function atSubmit($t): LeaveRequest
{
    $t->actingAs($t->emp)->post(route('leave.store'), [
        'leave_type_id' => $t->type->id, 'starts_on' => '2026-11-29', 'ends_on' => '2026-11-30', 'half_day' => 'none', 'reason' => 'Trip',
    ])->assertSessionHasNoErrors();

    return LeaveRequest::where('employee_id', $t->emp->employee_id)->firstOrFail();
}

it('stores who cancelled and builds the trail', function () {
    $r = atSubmit($this);
    $this->actingAs($this->lead)->post(route('leave.approve', $r))->assertSessionHasNoErrors();
    $this->actingAs($this->emp)->post(route('leave.cancel', $r->fresh()))->assertSessionHasNoErrors();

    $r->refresh();
    expect($r->cancelled_by)->toBe($this->emp->employee_id)->and($r->cancelled_at)->not->toBeNull();
    $kinds = array_column(Trail::for([$r])[$r->id], 'kind');
    expect($kinds)->toBe(['requested', 'approved', 'cancelled']);
    expect(array_column(Audit::entries($r), 'text'))->toContain('Requested', 'Cancelled');

    $this->actingAs($this->emp)->get(route('leave.mine'))->assertInertia(fn (Assert $p) => $p->has("trail.{$r->id}", 3)->where("trail.{$r->id}.0.by", $this->emp->employee->name));
});

it('refuses a missing decider', function () {
    $r = atSubmit($this);
    expect(fn () => app(ApproveAsLead::class)($r, null))->toThrow(ValidationException::class);
});

it('logs profile edits, salary and bank with before and after, and shows them to HR only', function () {
    $target = makeUser('employee');
    $this->actingAs($this->hr)->patch(route('people.update', $target->employee), ['name' => 'Renamed Person', 'designation' => 'Engineer', 'email' => $target->employee->email, 'phone' => '01700000000'])->assertSessionHasNoErrors();
    $this->actingAs($this->hr)->post(route('people.bank', $target->employee), ['bank' => 'BRAC', 'branch' => 'Banani', 'account_name' => 'X', 'account_no' => '1234567890', 'routing_no' => '060261579'])->assertSessionHasNoErrors();
    $this->actingAs($this->hr)->post(route('people.salary', $target->employee), ['effective_from' => '2026-12-01', 'basic' => 50000, 'house_rent' => 20000, 'medical' => 5000, 'conveyance' => 5000, 'pf_percent' => 0, 'tax_monthly' => 0, 'note' => 'Promotion'])->assertSessionHasNoErrors();

    $texts = implode("\n", array_column(Audit::entries($target->employee->fresh()), 'text'));
    expect($texts)->toContain('Updated details')->toContain('Renamed Person')->toContain('Added bank account')->toContain('****7890')->not->toContain('1234567890')
        ->toContain('gross none to 80,000')->toContain('Promotion');

    $this->actingAs($this->hr)->get(route('people.profile', $target->employee))->assertInertia(fn (Assert $p) => $p->where('activity.0.actor', $this->hr->employee->name));
    $this->actingAs($target)->get(route('people.profile', $target->employee))->assertInertia(fn (Assert $p) => $p->where('activity', null));
});

it('rejects an upload with a disallowed type', function () {
    $target = makeUser('employee');
    $this->actingAs($this->hr)->post(route('people.documents', $target->employee), ['kind' => 'other', 'file' => UploadedFile::fake()->create('x.exe', 10)])->assertSessionHasErrors('file');
});

it('limits the audit log page to manage_settings and exports csv', function () {
    Audit::record(['employee', $this->emp->employee_id], '=cmd', $this->hr->employee_id);
    $this->actingAs($this->emp)->get(route('settings.audit-log.index'))->assertForbidden();
    $this->actingAs($this->lead)->get(route('settings.audit-log.index'))->assertForbidden();
    $this->actingAs($this->hr)->get(route('settings.audit-log.index', ['q' => 'cmd']))->assertInertia(fn (Assert $p) => $p->component('Settings/AuditLogPage')->where('meta.total', 1));
    $csv = $this->actingAs($this->hr)->get(route('settings.audit-log.export'))->assertOk()->streamedContent();
    expect($csv)->toContain("'=cmd");
    expect(ActivityLogEntry::count())->toBeGreaterThan(0);
});
