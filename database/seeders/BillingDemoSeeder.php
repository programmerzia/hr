<?php

namespace Database\Seeders;

use App\Domain\Billing\Actions\MarkOverdue;
use App\Domain\Billing\Services\InvoiceTotals;
use App\Domain\Billing\Services\TrackedTime;
use App\Models\ActivityLogEntry;
use App\Models\Client;
use App\Models\ContractorClaim;
use App\Models\Employee;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\InvoicePayment;
use App\Models\Project;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Three clients, six invoices in mixed states for PULSE and ERP (plus an Apex retainer) and two paid claims for
 * Nusrat Jahan. Called by DemoSeeder after Work (clients, projects, task time entries) exists.
 */
class BillingDemoSeeder extends Seeder
{
    /** Tracked minutes used when no task time entries exist for the month (entries only cover the last 30 days). */
    private const FALLBACK_MINUTES = [9 => 9480, 10 => 9900];

    public function run(): void
    {
        if (Invoice::exists()) {
            return;
        }
        $mgmt = Employee::where('name', 'Rafiq Ahmed')->first();
        $clients = [
            'northwind' => Client::firstOrCreate(['name' => 'Northwind Logistics'], ['email' => 'accounts@northwind-logistics.example', 'address' => "1200 Harbor Way, Suite 400\nRotterdam 3011, Netherlands", 'currency' => 'USD', 'default_rate' => 40]),
            'apex' => Client::firstOrCreate(['name' => 'Apex Retail Group'], ['email' => 'finance@apexretail.example', 'address' => "House 14, Road 27, Gulshan 1\nDhaka 1212, Bangladesh", 'currency' => 'BDT', 'default_rate' => 3500]),
            'harbor' => Client::firstOrCreate(['name' => 'Harbor Health'], ['email' => 'ap@harborhealth.example', 'address' => "88 Wellington Street\nToronto ON M5H 1J8, Canada", 'currency' => 'USD', 'default_rate' => 35]),
        ];
        $pulse = Project::where('key', 'PULSE')->first();
        $erp = Project::where('key', 'ERP')->first();

        // number (null = draft), client, project, issued, due, currency, lines, tax, discount, status, notes, payments
        $specs = [
            [1, 'northwind', $pulse, '2026-09-01', '2026-09-15', 'USD', [['Pulse mobile app retainer, September 2026', 1, 4500]], 0, 0, 'paid', null, [['2026-09-14', 4500, 'Wire transfer', 'NW-WIRE-0914']]],
            [2, 'apex', null, '2026-09-05', '2026-09-20', 'BDT', [['Hosting and maintenance, September 2026', 1, 85000]], 5, 0, 'sent', null, [['2026-10-06', 50000, 'Bank transfer', 'APX-BT-1006']]],
            [3, 'harbor', $erp, '2026-09-30', '2026-10-21', 'USD', [['Backend development, 120 h', 120, 35], ['Warehouse module QA, 36 h', 36, 35], ['Staging environment hosting', 1, 180]], 0, 120, 'sent', 'Discount applied for the late delivery of the reporting module.', []],
            [4, 'northwind', $pulse, '2026-10-01', '2026-11-02', 'USD', [['Pulse mobile app retainer, October 2026', 1, 4500]], 0, 0, 'sent', null, []],
            [5, 'harbor', $erp, '2026-10-31', '2026-11-21', 'USD', [['Backend development, 104 h', 104, 35], ['Warehouse module QA, 24 h', 24, 35], ['Staging environment hosting', 1, 180]], 0, 0, 'sent', null, [['2026-11-09', 2000, 'Wire transfer', 'HH-2111']]],
            [null, 'northwind', $pulse, '2026-11-10', '2026-12-10', 'USD', [['Pulse mobile app retainer, November 2026', 1, 4500]], 0, 0, 'draft', null, []],
        ];

        foreach ($specs as $k => [$n, $clientKey, $project, $issued, $due, $currency, $lines, $tax, $discount, $status, $notes, $pays]) {
            $parsed = array_map(fn ($l) => ['qty' => $l[1], 'unit_price' => $l[2]], $lines);
            $t = InvoiceTotals::compute($parsed, $tax, $discount);
            $paidTotal = array_sum(array_column($pays, 1));
            $invoice = Invoice::create([
                'number' => $n ? sprintf('VIV-%s-%04d', substr($issued, 0, 4), $n) : 'DRAFT-'.strtoupper(substr(md5((string) $k), 0, 8)),
                'client_id' => $clients[$clientKey]->id, 'project_id' => $project?->id,
                'issued_on' => $issued, 'due_on' => $due, 'currency' => $currency,
                'subtotal' => $t['subtotal'], 'tax_percent' => $tax, 'discount' => $discount, 'total' => $t['total'],
                'paid_total' => $paidTotal, 'status' => $status, 'notes' => $notes,
            ]);
            foreach ($lines as [$description, $qty, $price]) {
                InvoiceLine::create(['invoice_id' => $invoice->id, 'description' => $description, 'qty' => $qty, 'unit_price' => $price, 'amount' => InvoiceTotals::amount($qty, $price)]);
            }
            $this->log('invoice', $invoice->id, 'created the invoice as a draft', $mgmt?->id, "{$issued} 09:00:00");
            if ($status !== 'draft') {
                $this->log('invoice', $invoice->id, 'sent the invoice to the client', $mgmt?->id, "{$issued} 10:00:00", ['number' => $invoice->number]);
            }
            foreach ($pays as [$paidOn, $amount, $method, $ref]) {
                InvoicePayment::create(['invoice_id' => $invoice->id, 'paid_on' => $paidOn, 'amount' => $amount, 'method' => $method, 'reference' => $ref]);
                $this->log('invoice', $invoice->id, 'recorded a payment of '.number_format($amount)." {$currency} ({$method})", $mgmt?->id, "{$paidOn} 12:00:00");
            }
        }
        app(MarkOverdue::class)();

        $this->claims($mgmt);
    }

    private function claims(?Employee $mgmt): void
    {
        $nusrat = Employee::where('name', 'Nusrat Jahan')->first();
        $lead = Employee::where('name', 'Tanvir Hossain')->first();
        if (! $nusrat) {
            return;
        }
        $rate = (int) ($nusrat->salaryStructures()->get()->last()?->hourly_rate ?? 0);
        $bank = $nusrat->bankAccounts()->orderByDesc('is_primary')->first();
        foreach ([9, 10] as $month) {
            $tracked = TrackedTime::minutes($nusrat->id, 2026, $month) ?: self::FALLBACK_MINUTES[$month];
            $next = CarbonImmutable::create(2026, $month, 1)->addMonth();
            $claim = ContractorClaim::create([
                'employee_id' => $nusrat->id, 'year' => 2026, 'month' => $month,
                'tracked_minutes' => $tracked, 'claimed_minutes' => $tracked, 'rate' => $rate, 'fixed_amount' => null,
                'total' => (int) round($tracked / 60 * $rate), 'status' => 'paid',
                'verified_by' => $lead?->id, 'approved_by' => $mgmt?->id,
                'paid_at' => $next->setDay(5)->setTime(11, 0), 'bank_account_id' => $bank?->id,
            ]);
            $at = fn (int $day, int $hour) => $next->setDay($day)->setTime($hour, 0)->format('Y-m-d H:i:s');
            $this->log('claim', $claim->id, 'generated the claim from tracked hours', $nusrat->id, $at(1, 9));
            $this->log('claim', $claim->id, 'submitted the claim', $nusrat->id, $at(1, 10));
            $this->log('claim', $claim->id, 'verified the hours', $lead?->id, $at(2, 10));
            $this->log('claim', $claim->id, 'approved the claim', $mgmt?->id, $at(3, 10));
            $this->log('claim', $claim->id, 'marked the claim as paid', $mgmt?->id, $at(5, 11));
        }
    }

    private function log(string $type, string $id, string $text, ?string $actor, string $at, array $props = []): void
    {
        $e = ActivityLogEntry::create(['subject_type' => $type, 'subject_id' => $id, 'actor_id' => $actor, 'description' => $text, 'properties' => $props ?: null]);
        $e->forceFill(['created_at' => $at, 'updated_at' => $at])->save();
    }
}
