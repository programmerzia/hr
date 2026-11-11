<?php

use App\Models\ActivityLogEntry;
use App\Models\AttendanceDay;
use App\Models\BankAccount;
use App\Models\Client;
use App\Models\ContractorClaim;
use App\Models\Department;
use App\Models\Invoice;
use App\Models\SalaryStructure;
use App\Models\TaskTimeEntry;
use App\Models\Team;
use App\Models\TimeSegment;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    $this->mgmt = makeUser('management');
    $this->hr = makeUser('hr');
    $this->lead = makeUser('team_lead');
    $this->contractor = makeUser('employee', ['employment_type' => 'contractor']);
    $this->staff = makeUser('employee');
    $team = Team::create(['name' => 'Web', 'department_id' => Department::create(['name' => 'Eng'])->id, 'lead_employee_id' => $this->lead->employee_id]);
    $this->contractor->employee->update(['team_id' => $team->id]);
    $this->lead->employee->update(['team_id' => $team->id]);
    $this->client = Client::create(['name' => 'Northwind', 'email' => 'ap@nw.example', 'address' => 'Rotterdam', 'currency' => 'USD', 'default_rate' => 40]);
});

function invoicePayload($t, array $over = []): array
{
    return [
        'client_id' => $t->client->id, 'project_id' => null, 'issued_on' => '2026-11-10', 'due_on' => '2026-12-10',
        'currency' => 'USD', 'lines' => [['description' => 'Retainer', 'qty' => 2, 'unit_price' => 1000]],
        'tax_percent' => 5, 'discount' => 100, 'notes' => null, ...$over,
    ];
}

function draftInvoice($t, array $over = []): Invoice
{
    $t->actingAs($t->mgmt)->post(route('billing.invoices.store'), invoicePayload($t, $over))->assertSessionDoesntHaveErrors();

    return Invoice::latest('created_at')->latest('id')->firstOrFail();
}

it('creates a draft with computed totals and a placeholder number', function () {
    $i = draftInvoice($this);
    expect($i->status)->toBe('draft')->and($i->number)->toStartWith('DRAFT-')
        ->and($i->subtotal)->toBe(2000)->and($i->total)->toBe(2000 + 100 - 100);
    expect(ActivityLogEntry::where('subject_id', $i->id)->count())->toBe(1);
});

it('assigns sequential VIV numbers on send', function () {
    $a = draftInvoice($this);
    $b = draftInvoice($this);
    $this->actingAs($this->mgmt)->post(route('billing.invoices.send', $a))->assertSessionDoesntHaveErrors();
    $this->actingAs($this->mgmt)->post(route('billing.invoices.send', $b));
    expect($a->fresh()->number)->toBe('VIV-2026-0001')->and($b->fresh()->number)->toBe('VIV-2026-0002')
        ->and($a->fresh()->status)->toBe('sent');
    $this->actingAs($this->mgmt)->post(route('billing.invoices.send', $a))->assertSessionHasErrors('billing');
});

it('marks the invoice paid once payments cover the total', function () {
    $i = draftInvoice($this, ['tax_percent' => 0, 'discount' => 0]);
    $this->actingAs($this->mgmt)->post(route('billing.invoices.send', $i));
    $pay = fn ($amount) => $this->actingAs($this->mgmt)->post(route('billing.invoices.payments.store', $i), ['paid_on' => '2026-11-12', 'amount' => $amount, 'method' => 'Wire transfer']);
    $pay(500)->assertSessionDoesntHaveErrors();
    expect($i->fresh()->status)->toBe('sent')->and($i->fresh()->paid_total)->toBe(500);
    $pay(5000)->assertSessionHasErrors(['billing' => 'Amount is more than the balance due']);
    $pay(1500);
    expect($i->fresh()->status)->toBe('paid');
    $this->actingAs($this->mgmt)->post(route('billing.invoices.void', $i))->assertSessionHasErrors('billing');
});

it('voids an unpaid invoice and sweeps overdue ones', function () {
    $late = draftInvoice($this, ['issued_on' => '2026-09-01', 'due_on' => '2026-09-15']);
    $this->actingAs($this->mgmt)->post(route('billing.invoices.send', $late));
    expect($late->fresh()->status)->toBe('overdue');
    $sent = draftInvoice($this, ['due_on' => '2026-11-20']);
    $this->actingAs($this->mgmt)->post(route('billing.invoices.send', $sent));
    $this->travelTo(now()->addDays(30));
    $this->artisan('billing:sweep-overdue')->assertSuccessful();
    expect($sent->fresh()->status)->toBe('overdue');
    $this->actingAs($this->mgmt)->post(route('billing.invoices.void', $sent))->assertSessionDoesntHaveErrors();
    expect($sent->fresh()->status)->toBe('void');
});

it('edits drafts only and validates with the mock messages', function () {
    $i = draftInvoice($this);
    $this->actingAs($this->mgmt)->patch(route('billing.invoices.update', $i), invoicePayload($this, ['lines' => [['description' => 'More', 'qty' => 1, 'unit_price' => 50]], 'tax_percent' => 0, 'discount' => 0]));
    expect($i->fresh()->total)->toBe(50);
    $this->actingAs($this->mgmt)->post(route('billing.invoices.store'), invoicePayload($this, ['due_on' => '2026-11-01']))
        ->assertSessionHasErrors(['due_on' => 'Due date cannot be before the issue date']);
    $this->actingAs($this->mgmt)->post(route('billing.invoices.send', $i));
    $this->actingAs($this->mgmt)->patch(route('billing.invoices.update', $i), invoicePayload($this))->assertSessionHasErrors('billing');
});

it('renders the invoice pages for management', function () {
    $i = draftInvoice($this);
    $this->actingAs($this->mgmt)->get(route('billing.invoices'))->assertInertia(fn (Assert $p) => $p->component('Billing/InvoicesPage', false)->has('invoices', 1)->has('aging')->has('paid_this_month'));
    $this->actingAs($this->mgmt)->get(route('billing.invoices.show', $i))->assertInertia(fn (Assert $p) => $p->component('Billing/InvoiceDetailPage', false)->has('lines', 1)->has('payments')->has('audit', 1)->has('client'));
    $this->actingAs($this->mgmt)->get(route('billing.invoices.print', $i))->assertInertia(fn (Assert $p) => $p->component('Billing/InvoicePrintPage', false));
    $this->actingAs($this->mgmt)->get(route('billing.clients'))->assertInertia(fn (Assert $p) => $p->component('Billing/ClientsPage', false)->has('clients', 1));
    $this->actingAs($this->mgmt)->get(route('billing.invoices.edit', $i))->assertInertia(fn (Assert $p) => $p->component('Billing/InvoiceEditorPage', false)->where('invoice.id', $i->id));
});

it('creates and updates clients', function () {
    $this->actingAs($this->mgmt)->post(route('billing.clients.store'), ['name' => 'Apex', 'email' => 'f@apex.example', 'address' => 'Dhaka', 'currency' => 'BDT', 'default_rate' => 3500])->assertSessionDoesntHaveErrors();
    $apex = Client::where('name', 'Apex')->firstOrFail();
    $this->actingAs($this->mgmt)->patch(route('billing.clients.update', $apex), ['default_rate' => 4000]);
    expect($apex->fresh()->default_rate)->toBe(4000);
    $this->actingAs($this->mgmt)->post(route('billing.clients.store'), ['name' => '', 'email' => 'x', 'currency' => 'USD'])->assertSessionHasErrors('name');
});

it('keeps billing away from everyone but management', function () {
    $i = draftInvoice($this);
    foreach (['staff', 'hr', 'lead', 'contractor'] as $who) {
        $this->actingAs($this->{$who})->get(route('billing.invoices'))->assertForbidden();
        $this->actingAs($this->{$who})->get(route('billing.invoices.show', $i))->assertForbidden();
        $this->actingAs($this->{$who})->get(route('billing.clients'))->assertForbidden();
        $this->actingAs($this->{$who})->post(route('billing.invoices.send', $i))->assertForbidden();
    }
    expect($i->fresh()->status)->toBe('draft');
});

function trackedEntries($t, int $minutes, string $date = '2026-10-15'): void
{
    $emp = $t->contractor->employee;
    $day = AttendanceDay::create(['employee_id' => $emp->id, 'date' => $date, 'status' => 'ended', 'work_seconds' => $minutes * 60]);
    $seg = TimeSegment::create(['attendance_day_id' => $day->id, 'type' => 'work', 'started_at' => "{$date} 09:00:00", 'ended_at' => "{$date} 17:00:00"]);
    TaskTimeEntry::create([
        'time_segment_id' => $seg->id, 'task_id' => (string) Str::uuid(), 'employee_id' => $emp->id,
        'started_at' => "{$date} 09:00:00", 'ended_at' => "{$date} 17:00:00", 'seconds' => $minutes * 60,
    ]);
    SalaryStructure::create([
        'employee_id' => $emp->id, 'effective_from' => '2024-01-01', 'basic' => 0, 'house_rent' => 0, 'medical' => 0,
        'conveyance' => 0, 'pf_percent' => 0, 'tax_monthly' => 0, 'gross' => 0, 'hourly_rate' => 1200,
    ]);
    BankAccount::create(['employee_id' => $emp->id, 'bank' => 'City Bank', 'account_name' => 'N', 'account_no' => '1', 'routing_no' => '2', 'branch' => 'Gulshan', 'is_primary' => true]);
}

it('generates a claim from tracked minutes at the salary hourly rate', function () {
    trackedEntries($this, 600);
    $this->actingAs($this->contractor)->post(route('billing.claims.generate'), ['year' => 2026, 'month' => 10])->assertSessionDoesntHaveErrors();
    $c = ContractorClaim::firstOrFail();
    expect($c->tracked_minutes)->toBe(600)->and($c->claimed_minutes)->toBe(600)->and($c->rate)->toBe(1200)
        ->and($c->total)->toBe(12000)->and($c->status)->toBe('draft')->and($c->bank_account_id)->not->toBeNull();
    // regenerating a draft replaces it; other months stay empty
    $this->actingAs($this->contractor)->post(route('billing.claims.generate'), ['year' => 2026, 'month' => 10]);
    expect(ContractorClaim::count())->toBe(1);
    $this->actingAs($this->contractor)->patch(route('billing.claims.update', $c), ['claimed_minutes' => 300, 'fixed_amount' => null]);
    expect($c->fresh()->total)->toBe(6000);
    $this->actingAs($this->contractor)->get(route('billing.claims.show', $c))->assertInertia(fn (Assert $p) => $p->component('Billing/ClaimDetailPage', false)->where('action', 'submit')->where('can_edit', true)->has('weeks', 1));
    $this->actingAs($this->contractor)->get(route('billing.claims.print', $c))->assertInertia(fn (Assert $p) => $p->component('Billing/ClaimPrintPage', false));
});

it('refuses claims for non contractors', function () {
    $this->actingAs($this->staff)->post(route('billing.claims.generate'), ['year' => 2026, 'month' => 10])->assertSessionHasErrors(['billing' => 'Claims are only for contractors']);
    $this->actingAs($this->staff)->post(route('billing.claims.generate'), ['year' => 2026, 'month' => 10, 'employee_id' => $this->contractor->employee_id])->assertForbidden();
});

it('walks a claim through lead verify, management approve and HR pay', function () {
    trackedEntries($this, 600);
    $this->actingAs($this->contractor)->post(route('billing.claims.generate'), ['year' => 2026, 'month' => 10]);
    $c = ContractorClaim::firstOrFail();

    $this->actingAs($this->contractor)->post(route('billing.claims.submit', $c))->assertSessionDoesntHaveErrors();
    expect($c->fresh()->status)->toBe('submitted')->and($this->lead->notifications()->count())->toBe(1)
        ->and($this->lead->notifications()->first()->data['kind'])->toBe('claim');

    $this->actingAs($this->mgmt)->post(route('billing.claims.verify', $c))->assertForbidden();
    $this->actingAs($this->staff)->post(route('billing.claims.verify', $c))->assertForbidden();
    $this->actingAs($this->lead)->post(route('billing.claims.verify', $c))->assertSessionDoesntHaveErrors();
    expect($c->fresh()->status)->toBe('verified')->and($c->fresh()->verified_by)->toBe($this->lead->employee_id)
        ->and($this->mgmt->notifications()->count())->toBe(1);

    $this->actingAs($this->lead)->post(route('billing.claims.approve', $c))->assertForbidden();
    $this->actingAs($this->hr)->post(route('billing.claims.pay', $c), ['paid_on' => '2026-11-12'])->assertSessionHasErrors('billing');
    $this->actingAs($this->mgmt)->post(route('billing.claims.approve', $c))->assertSessionDoesntHaveErrors();
    expect($c->fresh()->status)->toBe('approved')->and($c->fresh()->approved_by)->toBe($this->mgmt->employee_id);

    $this->actingAs($this->contractor)->post(route('billing.claims.pay', $c), ['paid_on' => '2026-11-12'])->assertForbidden();
    $this->actingAs($this->hr)->post(route('billing.claims.pay', $c), ['paid_on' => '2026-11-12', 'reference' => 'TRX-9'])->assertSessionDoesntHaveErrors();
    expect($c->fresh()->status)->toBe('paid')->and($c->fresh()->paid_at->format('Y-m-d'))->toBe('2026-11-12');
    expect(ActivityLogEntry::where('subject_id', $c->id)->orderBy('created_at')->pluck('description')->all())
        ->toContain('submitted the claim', 'verified the hours', 'approved the claim', 'marked the claim as paid (ref TRX-9)');
});

it('does not let a contractor approve or verify their own claim', function () {
    trackedEntries($this, 600);
    $this->actingAs($this->contractor)->post(route('billing.claims.generate'), ['year' => 2026, 'month' => 10]);
    $c = ContractorClaim::firstOrFail();
    $c->update(['status' => 'verified']);
    $this->actingAs($this->contractor)->post(route('billing.claims.approve', $c))->assertForbidden();
    $c->update(['status' => 'submitted']);
    $this->actingAs($this->contractor)->post(route('billing.claims.verify', $c))->assertForbidden();
});

it('scopes the claims list and badges by role', function () {
    trackedEntries($this, 600);
    $this->actingAs($this->contractor)->post(route('billing.claims.generate'), ['year' => 2026, 'month' => 10]);
    $c = ContractorClaim::firstOrFail();
    $c->update(['status' => 'submitted']);
    $other = makeUser('employee', ['employment_type' => 'contractor']);

    $this->actingAs($this->lead)->get(route('billing.claims'))->assertInertia(fn (Assert $p) => $p->component('Billing/ClaimsPage', false)
        ->has('claims', 1)->where('mode', 'lead')->where('awaiting', [$c->id])->where("actions.{$c->id}", 'verify')->where('badges.claims', 1));
    $this->actingAs($this->mgmt)->get(route('billing.claims'))->assertInertia(fn (Assert $p) => $p->has('claims', 1)->where('awaiting', [])->where('badges.claims', 0));
    $this->actingAs($other)->get(route('billing.claims'))->assertInertia(fn (Assert $p) => $p->has('claims', 0));
    $this->actingAs($other)->get(route('billing.claims.show', $c))->assertForbidden();
    $this->actingAs($this->staff)->get(route('billing.claims'))->assertForbidden();
});
