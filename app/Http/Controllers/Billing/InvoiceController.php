<?php

namespace App\Http\Controllers\Billing;

use App\Domain\Billing\Actions\MarkOverdue;
use App\Domain\Billing\Actions\RecordPayment;
use App\Domain\Billing\Actions\SaveInvoice;
use App\Domain\Billing\Actions\SendInvoice;
use App\Domain\Billing\Actions\VoidInvoice;
use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Http\Controllers\Controller;
use App\Http\Requests\Billing\InvoiceRequest;
use App\Http\Requests\Billing\PaymentRequest;
use App\Http\Resources\ClientResource;
use App\Http\Resources\InvoiceLineResource;
use App\Http\Resources\InvoicePaymentResource;
use App\Http\Resources\InvoiceResource;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\InvoicePayment;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class InvoiceController extends Controller
{
    private const OPEN = ['sent', 'overdue'];

    public function index(MarkOverdue $sweep): Response
    {
        Gate::authorize('viewAny', Invoice::class);
        $sweep();
        $invoices = Invoice::orderByDesc('issued_on')->orderByDesc('number')->get();
        $today = now()->startOfDay();

        // Outstanding balance by age past the due date: current, 1-30, 31-60, over 60 (one row per currency).
        $aging = [];
        foreach ($invoices->whereIn('status', self::OPEN) as $i) {
            $late = (int) $i->due_on->startOfDay()->diffInDays($today, false);
            $bucket = $late <= 0 ? 0 : ($late <= 30 ? 1 : ($late <= 60 ? 2 : 3));
            $aging[$i->currency] ??= [0, 0, 0, 0];
            $aging[$i->currency][$bucket] += $i->total - $i->paid_total;
        }

        $paid = InvoicePayment::whereDate('paid_on', '>=', $today->startOfMonth()->format('Y-m-d'))
            ->whereDate('paid_on', '<=', $today->endOfMonth()->format('Y-m-d'))->get();
        $currency = $invoices->pluck('currency', 'id');

        return Inertia::render('Billing/InvoicesPage', [
            'invoices' => InvoiceResource::collection($invoices)->resolve(),
            'clients' => ClientResource::collection(Client::orderBy('name')->get())->resolve(),
            'projects' => Project::orderBy('name')->get(['id', 'name', 'client_id']),
            'aging' => collect($aging)->map(fn ($buckets, $cur) => ['currency' => $cur, 'buckets' => $buckets])->values(),
            'paid_this_month' => $paid->groupBy(fn ($p) => $currency[$p->invoice_id] ?? 'BDT')
                ->map(fn ($rows, $cur) => ['currency' => $cur, 'amount' => (int) $rows->sum('amount')])->values(),
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', Invoice::class);

        return $this->editor(null, $request->query('client'));
    }

    public function edit(Invoice $invoice): Response
    {
        Gate::authorize('update', $invoice);
        if ($invoice->status !== 'draft') {
            Fail::with('Only draft invoices can be edited');
        }

        return $this->editor($invoice, null);
    }

    private function editor(?Invoice $invoice, ?string $presetClient): Response
    {
        return Inertia::render('Billing/InvoiceEditorPage', [
            'invoice' => $invoice ? InvoiceResource::make($invoice)->resolve() : null,
            'lines' => $invoice ? InvoiceLineResource::collection(InvoiceLine::where('invoice_id', $invoice->id)->orderBy('created_at')->orderBy('id')->get())->resolve() : [],
            'clients' => ClientResource::collection(Client::orderBy('name')->get())->resolve(),
            'projects' => Project::orderBy('name')->get(['id', 'name', 'client_id']),
            'preset_client_id' => $presetClient,
        ]);
    }

    public function store(InvoiceRequest $request, SaveInvoice $save): RedirectResponse
    {
        Gate::authorize('create', Invoice::class);
        $invoice = $save($request->validated(), null, $request->user()->employee_id);

        return redirect()->route('billing.invoices.show', $invoice)->with('success', 'Draft saved');
    }

    public function update(InvoiceRequest $request, Invoice $invoice, SaveInvoice $save): RedirectResponse
    {
        Gate::authorize('update', $invoice);
        $save($request->validated(), $invoice, $request->user()->employee_id);

        return redirect()->route('billing.invoices.show', $invoice)->with('success', 'Draft saved');
    }

    public function show(Invoice $invoice): Response
    {
        Gate::authorize('view', $invoice);

        return Inertia::render('Billing/InvoiceDetailPage', $this->detail($invoice));
    }

    /** Bare layout sheet for printing or saving as PDF. */
    public function print(Invoice $invoice): Response
    {
        Gate::authorize('view', $invoice);

        return Inertia::render('Billing/InvoicePrintPage', $this->detail($invoice));
    }

    /** @return array<string, mixed> */
    private function detail(Invoice $invoice): array
    {
        return [
            'invoice' => InvoiceResource::make($invoice)->resolve(),
            'client' => ClientResource::make($invoice->client)->resolve(),
            'project' => $invoice->project ? $invoice->project->only(['id', 'name']) : null,
            'lines' => InvoiceLineResource::collection(InvoiceLine::where('invoice_id', $invoice->id)->orderBy('created_at')->orderBy('id')->get())->resolve(),
            'payments' => InvoicePaymentResource::collection(InvoicePayment::where('invoice_id', $invoice->id)->orderBy('paid_on')->orderBy('created_at')->get())->resolve(),
            'audit' => Audit::entries('invoice', $invoice->id),
        ];
    }

    public function send(Request $request, Invoice $invoice, SendInvoice $send): RedirectResponse
    {
        Gate::authorize('send', $invoice);
        $sent = $send($invoice, $request->user()->employee_id);

        return back()->with('success', "Invoice {$sent->number} sent");
    }

    public function pay(PaymentRequest $request, Invoice $invoice, RecordPayment $record): RedirectResponse
    {
        Gate::authorize('pay', $invoice);
        $record($invoice, $request->validated(), $request->user()->employee_id);

        return back()->with('success', 'Payment recorded');
    }

    public function void(Request $request, Invoice $invoice, VoidInvoice $void): RedirectResponse
    {
        Gate::authorize('void', $invoice);
        $void($invoice, $request->user()->employee_id);

        return back()->with('success', 'Invoice voided');
    }
}
