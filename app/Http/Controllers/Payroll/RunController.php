<?php

namespace App\Http\Controllers\Payroll;

use App\Domain\Payroll\Actions\ApproveRun;
use App\Domain\Payroll\Actions\DiscardRun;
use App\Domain\Payroll\Actions\DraftRun;
use App\Domain\Payroll\Actions\MarkPaid;
use App\Domain\Payroll\Actions\Recompute;
use App\Domain\Payroll\Actions\ReopenRun;
use App\Domain\Payroll\Actions\SubmitForReview;
use App\Domain\Payroll\Services\BankAdvice;
use App\Domain\Payroll\Services\MakerChecker;
use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Payroll\Services\PayrollRegister;
use App\Domain\Payroll\Services\PayslipPdf;
use App\Domain\Payroll\Support\Shape;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payroll\MarkPaidRequest;
use App\Http\Requests\Payroll\StoreRunRequest;
use App\Http\Resources\PayrollRunResource;
use App\Models\Employee;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class RunController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', PayrollRun::class);
        $runs = PayrollRun::orderByDesc('year')->orderByDesc('month')->get();
        $items = PayrollItem::whereIn('run_id', $runs->pluck('id'))->get()->groupBy('run_id');
        $adjustments = PayrollAdjustment::whereIn('item_id', $items->flatten()->pluck('id'))->get();

        $rows = $runs->map(fn (PayrollRun $r) => [
            ...PayrollRunResource::make($r)->resolve(),
            'totals' => Shape::totals($items[$r->id] ?? collect(), $adjustments->whereIn('item_id', ($items[$r->id] ?? collect())->pluck('id'))),
        ])->values();

        return Inertia::render('Payroll/RunsPage', [
            'runs' => $rows,
            'people' => Shape::people($runs->pluck('approved_by')->merge($runs->pluck('employee_id'))),
            'exited' => Employee::where('employment_type', 'full_time')->whereIn('status', ['resigned', 'terminated'])->whereNotNull('exited_on')
                ->whereNotIn('id', $runs->where('kind', 'settlement')->pluck('employee_id')->filter())
                ->orderByDesc('exited_on')->get()
                ->map(fn (Employee $e) => ['id' => $e->id, 'name' => $e->name, 'code' => $e->code, 'exited_on' => $e->exited_on->format('Y-m-d')])->all(),
        ]);
    }

    public function store(StoreRunRequest $form, DraftRun $draft): RedirectResponse
    {
        Gate::authorize('manage_payroll');
        $kind = $form->input('kind') ?: 'regular';
        $run = $draft(
            $form->integer('year'), $form->integer('month'), $form->user()->employee, $kind,
            $form->filled('bonus_percent_of_basic') ? (float) $form->input('bonus_percent_of_basic') : null,
            $form->input('label'),
            $kind === 'settlement' ? Employee::find($form->input('employee_id')) : null,
        );

        return to_route('payroll.runs.show', $run)->with('success', match ($kind) {
            'festival' => 'Festival bonus run started',
            'settlement' => 'Final settlement started',
            default => 'Payroll run started',
        });
    }

    public function show(Request $request, PayrollRun $run): Response
    {
        Gate::authorize('view', $run);
        $items = PayrollItem::with('employee')->where('run_id', $run->id)->get()->sortBy(fn ($i) => $i->employee?->name)->values();
        $adjustments = PayrollAdjustment::whereIn('item_id', $items->pluck('id'))->orderBy('created_at')->get();
        $events = Shape::events($run->id);
        $me = $request->user()->employee;
        $block = $me ? MakerChecker::blockReason($run, $me) : null;

        return Inertia::render('Payroll/RunDetailPage', [
            'run' => PayrollRunResource::make($run)->resolve(),
            'items' => $items->map(fn (PayrollItem $i) => Shape::item($i))->all(),
            'policy' => Shape::policy($run, $items),
            'adjustments' => Shape::adjustmentsFor($items->pluck('id')),
            'approval' => [
                'blocked' => $block,
                'single_approver' => MakerChecker::singleApproverAllowed(),
                'month_ended' => now()->toDateString() > PayrollPeriod::end($run->year, $run->month),
            ],
            'bank_skipped' => in_array($run->status, ['approved', 'paid'], true) ? BankAdvice::skipped($run) : [],
            'totals' => Shape::totals($items, $adjustments),
            'mix' => Shape::mix($items, $adjustments),
            'events' => $events,
            'people' => Shape::people($items->pluck('employee_id')->push($run->employee_id, $run->prepared_by, $run->submitted_by, $run->approved_by, $run->paid_by)->merge(collect($events)->pluck('actor_id'))),
        ]);
    }

    public function recompute(Request $request, PayrollRun $run, Recompute $action): RedirectResponse
    {
        Gate::authorize('manage', $run);
        $action($run, $request->user()->employee);

        return back()->with('success', 'Recomputed from attendance and leave');
    }

    public function destroy(Request $request, PayrollRun $run, DiscardRun $action): RedirectResponse
    {
        Gate::authorize('manage', $run);
        $action($run, $request->user()->employee);

        return redirect()->route('payroll.runs')->with('success', 'Draft run discarded');
    }

    public function submit(Request $request, PayrollRun $run, SubmitForReview $action): RedirectResponse
    {
        Gate::authorize('manage', $run);
        $data = $request->validate(['pay_early' => ['nullable', 'boolean'], 'early_reason' => ['nullable', 'string', 'max:255']]);
        $action($run, $request->user()->employee, (bool) ($data['pay_early'] ?? false), $data['early_reason'] ?? null);

        return back()->with('success', 'Sent for review');
    }

    public function approve(Request $request, PayrollRun $run, ApproveRun $action): RedirectResponse
    {
        Gate::authorize('approve', $run);
        $action($run, $request->user()->employee);

        return back()->with('success', 'Run approved and locked');
    }

    public function reopen(Request $request, PayrollRun $run, ReopenRun $action): RedirectResponse
    {
        Gate::authorize('approve', $run);
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], ['reason.required' => 'Give a reason for reopening the run.']);
        $action($run, $data['reason'], $request->user()->employee);

        return back()->with('success', 'Run reopened for review');
    }

    public function bankAdvice(PayrollRun $run): HttpResponse
    {
        Gate::authorize('view', $run);
        abort_unless(in_array($run->status, ['approved', 'paid'], true), 404);
        $name = BankAdvice::filename($run);

        return response(BankAdvice::csv($run), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$name}\"",
        ]);
    }

    public function register(PayrollRun $run): HttpResponse
    {
        Gate::authorize('view', $run);
        $name = PayrollRegister::filename($run);

        return response(PayrollRegister::csv($run), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$name}\"",
        ]);
    }

    public function payslipsZip(PayrollRun $run): BinaryFileResponse
    {
        Gate::authorize('view', $run);
        abort_unless($run->status === 'paid', 404);
        $zip = new \ZipArchive;
        $path = tempnam(sys_get_temp_dir(), 'payslips');
        $zip->open($path, \ZipArchive::OVERWRITE);
        foreach (PayrollItem::with('employee')->where('run_id', $run->id)->where('hold', false)->get() as $item) {
            $code = preg_replace('/[^A-Za-z0-9_-]/', '_', (string) ($item->employee?->code ?: $item->employee_id));
            $zip->addFile(PayslipPdf::ensure($item), sprintf('payslip-%s-%d-%02d.pdf', $code, $run->year, $run->month));
        }
        $zip->close();

        return response()->download($path, sprintf('payslips-%d-%02d.zip', $run->year, $run->month), ['Content-Type' => 'application/zip'])->deleteFileAfterSend();
    }

    public function pay(MarkPaidRequest $form, PayrollRun $run, MarkPaid $action): RedirectResponse
    {
        Gate::authorize('approve', $run);
        $action($run, $form->validated('paid_on'), $form->validated('reference'), $form->user()->employee);

        return back()->with('success', 'Run marked as paid');
    }
}
