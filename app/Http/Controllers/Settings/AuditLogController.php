<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\ActivityLogEntry;
use App\Models\Employee;
use App\Models\LeaveRequest;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Company-wide audit log (everything written through App\Support\Audit). Permission manage_settings (route middleware). */
class AuditLogController extends Controller
{
    private const PER_PAGE = 50;

    public function index(Request $request): Response
    {
        $page = $this->query($request)->paginate(self::PER_PAGE)->withQueryString();
        $rows = collect($page->items());

        $employeeSubjects = $rows->where('subject_type', 'employee')->pluck('subject_id');
        $leaveSubjects = LeaveRequest::whereIn('id', $rows->where('subject_type', 'leave_request')->pluck('subject_id'))->get(['id', 'employee_id', 'starts_on']);
        $names = Employee::whereIn('id', $employeeSubjects->merge($leaveSubjects->pluck('employee_id')))->pluck('name', 'id');
        $leave = $leaveSubjects->keyBy('id');

        return Inertia::render('Settings/AuditLogPage', [
            'entries' => $rows->map(fn (ActivityLogEntry $e) => [
                'id' => $e->id,
                'at' => $e->created_at->copy()->setTimezone(config('app.timezone'))->toIso8601String(),
                'actor' => $e->actor?->name ?? 'System',
                'subject_type' => $e->subject_type,
                'subject' => match ($e->subject_type) {
                    'employee' => $names[$e->subject_id] ?? null,
                    'leave_request' => ($l = $leave[$e->subject_id] ?? null) ? ($names[$l->employee_id] ?? '').' '.$l->starts_on->format('j M Y') : null,
                    default => null,
                },
                'text' => $e->description,
            ])->all(),
            'meta' => ['page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            'filters' => $request->only(['actor', 'type', 'from', 'to', 'q']),
            'actors' => Employee::whereIn('id', ActivityLogEntry::query()->whereNotNull('actor_id')->distinct()->pluck('actor_id'))->orderBy('name')->get(['id', 'name'])->map->only(['id', 'name'])->all(),
            'types' => ActivityLogEntry::query()->distinct()->orderBy('subject_type')->pluck('subject_type')->all(),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $query = $this->query($request);

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['When', 'Who', 'Subject type', 'Subject id', 'What']);
            $query->lazy(500)->each(function (ActivityLogEntry $e) use ($out) {
                fputcsv($out, array_map(self::safe(...), [
                    $e->created_at->copy()->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s'),
                    $e->actor?->name ?? 'System', $e->subject_type, $e->subject_id, $e->description,
                ]));
            });
            fclose($out);
        }, 'audit-log-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv']);
    }

    /** Stops a spreadsheet from running a cell that starts with a formula character. */
    private static function safe(string $v): string
    {
        return $v !== '' && str_contains('=+-@', $v[0]) ? "'".$v : $v;
    }

    private function query(Request $request): Builder
    {
        $f = $request->validate([
            'actor' => ['nullable', 'string'], 'type' => ['nullable', 'string'],
            'from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d'], 'q' => ['nullable', 'string', 'max:100'],
        ]);

        return ActivityLogEntry::with('actor:id,name')
            ->when($f['actor'] ?? null, fn ($q, $v) => $q->where('actor_id', $v))
            ->when($f['type'] ?? null, fn ($q, $v) => $q->where('subject_type', $v))
            ->when($f['from'] ?? null, fn ($q, $v) => $q->where('created_at', '>=', "{$v} 00:00:00"))
            ->when($f['to'] ?? null, fn ($q, $v) => $q->where('created_at', '<', date('Y-m-d', strtotime("{$v} +1 day")).' 00:00:00'))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where('description', 'like', '%'.addcslashes($v, '%_\\').'%'))
            ->orderByDesc('created_at')->orderByDesc('id');
    }
}
