<?php

namespace App\Domain\Home;

use App\Domain\Attendance\Services\Presence;
use App\Domain\Attendance\Services\Scope;
use App\Domain\Attendance\Services\Series;
use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Support\Shape;
use App\Models\AttendanceDay;
use App\Models\BoardColumn;
use App\Models\ContractorClaim;
use App\Models\Employee;
use App\Models\Invoice;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\Task;
use App\Models\User;
use App\Support\Badges;
use Carbon\CarbonImmutable;

/** Builds the Home dashboard props for the viewer's role. Tables owned by other modules are read directly. */
final class HomeData
{
    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /** @return array<string,mixed> */
    public static function for(User $user): array
    {
        $now = CarbonImmutable::now();
        $isManager = $user->role !== 'employee' && $user->role !== 'contractor';
        $isHr = in_array($user->role, ['hr', 'management'], true);

        return [
            'overview' => self::overview($user, $now, $isHr),
            'team_now' => $isManager ? self::teamNow($user, $now) : [],
            'my_tasks' => self::myTasks($user),
            'leave_balances' => self::leaveBalances($user, $now),
            'attention' => $isManager ? self::attention($user) : [],
            'payroll' => $isHr ? self::payroll() : null,
            'billing' => $user->role === 'management' ? self::billing($now) : null,
            'hiring' => $isHr ? self::hiring($now, 6) : null,
            'chat_unread' => 0,
        ];
    }

    /** Presence counts for the viewer's scope: company for HR and management, otherwise their team. */
    private static function overview(User $user, CarbonImmutable $now, bool $isHr): array
    {
        $people = $isHr ? Scope::employees($user) : self::teamScope($user);
        $ids = $people->pluck('id')->all();
        $days = AttendanceDay::whereIn('employee_id', $ids)->whereDate('date', $now->toDateString())->get()->keyBy('employee_id');
        $seen = User::whereIn('employee_id', $ids)->pluck('last_seen_at', 'employee_id');
        $n = ['working' => 0, 'break' => 0, 'offline' => 0, 'leave' => 0, 'ended' => 0, 'not_started' => 0, 'absent' => 0];
        foreach ($ids as $id) {
            $day = $days[$id] ?? null;
            $status = $day?->status ?? 'not_started';
            if ($status === 'working') {
                $p = Presence::of($day, $seen[$id] ?? null, $now);
                $n[$p['state'] === 'offline' ? 'offline' : 'working']++;
            } elseif ($status === 'on_break') {
                $n['break']++;
            } elseif ($status === 'on_leave') {
                $n['leave']++;
            } elseif ($status === 'ended') {
                $n['ended']++;
            } elseif ($status === 'absent') {
                $n['absent']++;
            } else {
                $n['not_started']++;
            }
        }

        $facts = [];
        if ($isHr) {
            $current = Employee::whereNull('exited_on');
            $facts = [
                ['label' => 'Headcount', 'value' => (clone $current)->count()],
                ['label' => 'On probation', 'value' => (clone $current)->where('status', 'probation')->count()],
                ['label' => 'Joining this month', 'value' => Employee::whereBetween('joined_on', [$now->startOfMonth()->toDateString(), $now->endOfMonth()->toDateString()])->count()],
            ];
        }

        return [
            'title' => $isHr ? 'Company today' : 'Team today',
            'total' => count($ids),
            'counts' => $n,
            'facts' => array_values(array_filter($facts, fn ($f) => $f['value'] > 0)),
        ];
    }

    private static function teamScope(User $user)
    {
        $team = $user->employee?->team_id;

        return $team
            ? Employee::whereNull('exited_on')->where('team_id', $team)
            : Scope::employees($user);
    }

    private static function teamNow(User $user, CarbonImmutable $now): array
    {
        $order = ['working', 'on_break', 'ended', 'not_started', 'on_leave', 'absent'];
        $people = Scope::employees($user)->where('id', '!=', $user->employee_id)->get(['id', 'name']);
        $days = AttendanceDay::whereIn('employee_id', $people->pluck('id'))->whereDate('date', $now->toDateString())->get()->keyBy('employee_id');
        $work = Series::workByDay($days->pluck('id'), $now);

        return $people->map(function ($e) use ($days, $work) {
            $d = $days[$e->id] ?? null;

            return [
                'id' => $e->id,
                'name' => $e->name,
                'status' => $d?->status ?? 'not_started',
                'first_in_at' => $d?->first_in_at?->toIso8601String(),
                'work_seconds' => $d ? (int) ($work[$d->id] ?? 0) : 0,
            ];
        })->sort(fn ($a, $b) => (array_search($a['status'], $order, true) <=> array_search($b['status'], $order, true)) ?: strcmp($a['name'], $b['name']))
            ->values()->all();
    }

    private static function myTasks(User $user): array
    {
        $done = BoardColumn::where('is_done', true)->select('id');
        $tasks = Task::with('project')->where('assignee_id', $user->employee_id)->whereNotIn('column_id', $done)->get()
            ->sort(fn ($a, $b) => strcmp((string) ($a->due_on?->format('Y-m-d') ?? '9999'), (string) ($b->due_on?->format('Y-m-d') ?? '9999')) ?: $a->number <=> $b->number)
            ->values();

        return [
            'total' => $tasks->count(),
            'items' => $tasks->take(6)->map(fn (Task $t) => [
                'id' => $t->id, 'key' => $t->key, 'title' => $t->title, 'priority' => $t->priority,
                'due_on' => $t->due_on?->format('Y-m-d'),
            ])->all(),
        ];
    }

    private static function leaveBalances(User $user, CarbonImmutable $now): array
    {
        if (! $user->employee) {
            return [];
        }
        $rows = app(BalanceService::class)->forEmployee($user->employee, $now->year);

        return array_values(array_map(fn ($r) => [
            ...Shape::balance($r),
            'type' => ['id' => $r['type']->id, 'name' => $r['type']->name],
        ], array_filter($rows, fn ($r) => ! $r['unlimited'] && (float) $r['balance']->entitled > 0)));
    }

    /** Pending decisions per kind. Counts come from the same providers as the nav badges. */
    private static function attention(User $user): array
    {
        $b = Badges::for($user);
        $rows = [
            ['label' => 'Leave requests to review', 'count' => $b['leave-approvals'], 'to' => '/leave/approvals'],
            ['label' => 'Regularizations to review', 'count' => $b['regularizations'], 'to' => '/team/regularizations'],
            ['label' => 'Claims to review', 'count' => $b['claims'], 'to' => '/claims'],
            ['label' => 'Payroll to review', 'count' => $b['payroll'], 'to' => '/payroll'],
        ];
        if ($user->role === 'management') {
            $rows[] = ['label' => 'Overdue invoices', 'count' => Invoice::where('status', 'overdue')->count(), 'to' => '/invoices', 'warn' => true];
        }

        return array_values(array_filter($rows, fn ($r) => $r['count'] > 0));
    }

    private static function payroll(): ?array
    {
        $runs = PayrollRun::orderByDesc('year')->orderByDesc('month')->limit(6)->get()->reverse()->values();
        if ($runs->isEmpty()) {
            return null;
        }
        $gross = PayrollItem::whereIn('run_id', $runs->pluck('id'))->selectRaw('run_id, sum(gross) as g')->groupBy('run_id')->pluck('g', 'run_id');
        $series = $runs->map(fn ($r) => ['label' => self::MONTHS[$r->month - 1], 'value' => (int) ($gross[$r->id] ?? 0)])->all();
        $latest = $runs->last();
        $previous = $runs->count() > 1 ? $runs[$runs->count() - 2] : null;

        return [
            'series' => $series,
            'latest' => ['id' => $latest->id, 'year' => $latest->year, 'month' => $latest->month, 'status' => $latest->status],
            'latest_gross' => (int) ($gross[$latest->id] ?? 0),
            'previous_gross' => $previous ? (int) ($gross[$previous->id] ?? 0) : 0,
        ];
    }

    private static function billing(CarbonImmutable $now): array
    {
        $rows = [];
        foreach (Invoice::whereIn('status', ['sent', 'overdue'])->get() as $i) {
            $late = (int) $i->due_on->startOfDay()->diffInDays($now->startOfDay(), false);
            $bucket = $late <= 0 ? 0 : ($late <= 30 ? 1 : ($late <= 60 ? 2 : 3));
            $rows[$i->currency] ??= [0, 0, 0, 0];
            $rows[$i->currency][$bucket] += $i->total - $i->paid_total;
        }

        return [
            'aging' => collect($rows)->map(fn ($arr, $cur) => ['currency' => $cur, 'total' => array_sum($arr), 'buckets' => $arr])->values()->all(),
            'claims_waiting' => ContractorClaim::whereIn('status', ['submitted', 'verified'])->count(),
        ];
    }

    /** @return array{data: list<array{label:string,value:int}>, total:int} */
    private static function hiring(CarbonImmutable $now, int $count): array
    {
        $data = [];
        for ($i = $count - 1; $i >= 0; $i--) {
            $m = $now->startOfMonth()->subMonths($i);
            $data[] = [
                'label' => self::MONTHS[$m->month - 1],
                'value' => Employee::whereBetween('joined_on', [$m->toDateString(), $m->endOfMonth()->toDateString()])->count(),
            ];
        }

        return ['data' => $data, 'total' => array_sum(array_column($data, 'value'))];
    }
}
