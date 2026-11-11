<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Services\DayCalculator;
use App\Domain\Attendance\Services\Scope;
use App\Domain\Attendance\Services\Series;
use App\Http\Controllers\Controller;
use App\Http\Resources\AttendanceDayResource;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\TeamResource;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\RegularizationRequest;
use App\Models\Team;
use App\Models\TimeSegment;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TeamHistoryController extends Controller
{
    private const LIMIT = 500;

    public function index(Request $request): Response
    {
        $f = $this->filters($request);
        $members = $this->members($request, $f);
        $rows = $this->rows($members, $f, self::LIMIT);

        return Inertia::render('Attendance/TeamHistoryPage', [
            'filters' => $f,
            'rows' => $rows['rows'],
            'total' => $rows['total'],
            'limit' => self::LIMIT,
            'members' => EmployeeResource::collection($members)->resolve(),
            'teams' => TeamResource::collection(Team::orderBy('name')->get())->resolve(),
            'heat' => Series::heat($members->pluck('id')->all(), now(), 30),
        ]);
    }

    public function csv(Request $request): StreamedResponse
    {
        $f = $this->filters($request);
        $rows = $this->rows($this->members($request, $f), $f, null)['rows'];
        $header = ['Date', 'Employee', 'Code', 'Team', 'In', 'Out', 'Work (min)', 'Break (min)', 'Offline (min)', 'Late (min)', 'Status', 'Regularized'];

        return response()->streamDownload(function () use ($header, $rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, $header);
            foreach ($rows as $r) {
                fputcsv($out, [
                    $r['day']['date'], $r['employee']['name'], $r['employee']['code'], $r['team'] ?? '',
                    $r['day']['first_in_at'] ? date('H:i', strtotime($r['day']['first_in_at'])) : '',
                    $r['day']['last_out_at'] ? date('H:i', strtotime($r['day']['last_out_at'])) : '',
                    intdiv($r['totals']['work_seconds'], 60), intdiv($r['totals']['break_seconds'], 60), intdiv($r['totals']['offline_seconds'], 60),
                    $r['day']['late_minutes'], $r['day']['status'], $r['regularization'] ?? '',
                ]);
            }
            fclose($out);
        }, "attendance-{$f['from']}-to-{$f['to']}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** @return array{from:string,to:string,team:string,employee:string,q:string} */
    private function filters(Request $request): array
    {
        $v = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'team' => ['nullable', 'string'],
            'employee' => ['nullable', 'string'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        return [
            'from' => $v['from'] ?? now()->subDays(6)->toDateString(),
            'to' => $v['to'] ?? now()->toDateString(),
            'team' => $v['team'] ?? 'all',
            'employee' => $v['employee'] ?? 'all',
            'q' => trim($v['q'] ?? ''),
        ];
    }

    private function members(Request $request, array $f)
    {
        return Scope::employees($request->user())
            ->when($f['team'] !== 'all', fn ($q) => $q->where('team_id', $f['team']))
            ->when($f['employee'] !== 'all', fn ($q) => $q->where('id', $f['employee']))
            ->when($f['q'] !== '', fn ($q) => $q->where('name', 'like', '%'.addcslashes($f['q'], '%_\\').'%'))
            ->orderBy('name')->get();
    }

    /** @return array{rows:list<array>,total:int} */
    private function rows($members, array $f, ?int $limit): array
    {
        $now = now();
        $cap = AttendancePolicy::current()->lunch_cap_minutes;
        $byId = $members->keyBy('id');
        $teams = Team::pluck('name', 'id');
        $q = AttendanceDay::whereIn('employee_id', $byId->keys())->whereBetween('date', [$f['from'], $f['to']])
            ->orderByDesc('date');
        $total = (clone $q)->count();
        $days = $q->when($limit, fn ($qq) => $qq->limit($limit))->get()
            ->sortBy([fn ($a, $b) => $b->date <=> $a->date, fn ($a, $b) => strcmp($byId[$a->employee_id]->name, $byId[$b->employee_id]->name)])
            ->values();
        $segs = TimeSegment::whereIn('attendance_day_id', $days->pluck('id'))->get()->groupBy('attendance_day_id');
        $regs = RegularizationRequest::whereIn('attendance_day_id', $days->pluck('id'))->get()->groupBy('attendance_day_id');

        $rows = $days->map(function (AttendanceDay $d) use ($byId, $segs, $regs, $teams, $now, $cap) {
            $e = $byId[$d->employee_id];
            $r = $regs[$d->id] ?? collect();
            $reg = $d->is_regularized ? 'Approved' : ($r->contains('status', 'pending') ? 'Pending' : ($r->contains('status', 'rejected') ? 'Rejected' : null));

            return [
                'day' => AttendanceDayResource::make($d)->resolve(),
                'employee' => ['id' => $e->id, 'name' => $e->name, 'code' => $e->code],
                'team' => $teams[$e->team_id] ?? null,
                'totals' => DayCalculator::totals($segs[$d->id] ?? [], $now, $cap),
                'regularization' => $reg,
            ];
        })->all();

        return ['rows' => $rows, 'total' => $total];
    }
}
