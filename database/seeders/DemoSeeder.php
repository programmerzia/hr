<?php

namespace Database\Seeders;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\BankAccount;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeAsset;
use App\Models\EmployeeDocument;
use App\Models\Holiday;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\OnboardingChecklistItem;
use App\Models\RegularizationRequest;
use App\Models\SalaryStructure;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\TimeSegment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/** Demo data mirroring resources/js/mock/db/people.ts and attendance.ts (8 people). */
class DemoSeeder extends Seeder
{
    /** n, name, designation, dept, team, role, type, status, joined, gross (contractor: hourly rate) */
    public const PEOPLE = [
        [101, 'Rafiq Ahmed', 'Managing director', 'ops', null, 'management', 'full_time', 'active', '2018-03-01', 260000],
        [102, 'Nasrin Akter', 'HR manager', 'ops', null, 'hr', 'full_time', 'active', '2019-06-16', 120000],
        [103, 'Tanvir Hossain', 'Engineering lead', 'eng', 'web', 'team_lead', 'full_time', 'active', '2019-01-07', 210000],
        [104, 'Farhana Yasmin', 'Design lead', 'design', 'design', 'team_lead', 'full_time', 'active', '2019-09-01', 165000],
        [107, 'Sadia Sultana', 'Senior software engineer', 'eng', 'web', 'employee', 'full_time', 'active', '2020-08-17', 150000],
        [109, 'Imran Kabir', 'Software engineer', 'eng', 'web', 'employee', 'full_time', 'active', '2021-07-12', 98000],
        [113, 'Fahim Reza', 'Engineering intern', 'eng', 'web', 'employee', 'intern', 'active', '2026-07-01', 20000],
        [114, 'Nusrat Jahan', 'Contract frontend developer', 'eng', 'web', 'employee', 'contractor', 'active', '2024-04-15', 1200],
    ];

    public const CHECKLIST = [
        'Laptop issued',
        'Email and chat accounts created',
        'Policy acknowledgement signed',
        'Bank details verified',
        'Employment contract signed',
    ];

    private const BANKS = [
        ['Dutch-Bangla Bank', 'Gulshan', '090261725'],
        ['BRAC Bank', 'Banani', '060261579'],
        ['City Bank', 'Motijheel', '225261741'],
        ['Eastern Bank', 'Dhanmondi', '095261379'],
    ];

    /** @var array<int, Employee> */
    private array $emp = [];

    private AttendancePolicy $policy;

    /** @var array<string, true> */
    private array $holidayDates = [];

    public function run(): void
    {
        $this->call(BaseDataSeeder::class);
        $this->policy = AttendancePolicy::current();

        $depts = [];
        foreach (['eng' => 'Engineering', 'design' => 'Design', 'qa' => 'QA', 'ops' => 'Operations'] as $k => $name) {
            $depts[$k] = Department::create(['name' => $name]);
        }
        $teams = [
            'web' => Team::create(['name' => 'Web platform', 'department_id' => $depts['eng']->id]),
            'design' => Team::create(['name' => 'Product design', 'department_id' => $depts['design']->id]),
        ];
        $password = Hash::make('password');

        foreach (self::PEOPLE as $i => [$n, $name, $designation, $dept, $team, $role, $type, $status, $joined, $gross]) {
            $email = strtolower(preg_replace('/[^a-z]+/i', '.', $name)).'@vivacom.example';
            $e = Employee::create([
                'code' => "VIV-{$n}",
                'name' => $name,
                'email' => $email,
                'department_id' => $depts[$dept]->id,
                'team_id' => $team ? $teams[$team]->id : null,
                'designation' => $designation,
                'employment_type' => $type,
                'status' => $status,
                'joined_on' => $joined,
                'probation_until' => $status === 'probation' ? '2026-12-01' : null,
                'phone' => '+88017'.substr((string) (10000000 + $n * 7919), 0, 8),
                'nid' => substr(str_pad((string) (1990000000 + $n * 104729), 13, '0'), 0, 13),
            ]);
            $u = User::create([
                'name' => $name, 'email' => $email, 'password' => $password, 'role' => $role,
                'employee_id' => $e->id, 'must_change_password' => false,
            ]);
            $e->update(['user_id' => $u->id]);
            if ($team) {
                TeamMember::create(['team_id' => $teams[$team]->id, 'employee_id' => $e->id]);
            }
            $this->emp[$n] = $e;

            // Append-only salary: hires before 2024 got a revision on 2025-07-01.
            $revised = $type === 'full_time' && $joined < '2024-01-01';
            $first = $revised ? (int) (round(($gross / 1.1) / 500) * 500) : $gross;
            SalaryStructure::create($this->structure($e->id, $joined, $first, $type));
            if ($revised) {
                SalaryStructure::create($this->structure($e->id, '2025-07-01', $gross, $type));
            }

            [$bank, $branch, $routing] = self::BANKS[$i % count(self::BANKS)];
            BankAccount::create([
                'employee_id' => $e->id, 'bank' => $bank, 'account_name' => $name,
                'account_no' => substr((string) (1010000000 + $n * 48611), 0, 10),
                'routing_no' => $routing, 'branch' => $branch, 'is_primary' => true,
            ]);
            EmployeeDocument::create([
                'employee_id' => $e->id, 'kind' => 'nid', 'name' => 'National ID copy.pdf',
                'path' => "documents/VIV-{$n}-nid.pdf", 'uploaded_at' => "{$joined} 10:00:00",
            ]);
            if ($type === 'full_time') {
                EmployeeDocument::create([
                    'employee_id' => $e->id, 'kind' => 'contract', 'name' => 'Employment contract.pdf',
                    'path' => "documents/VIV-{$n}-contract.pdf", 'uploaded_at' => "{$joined} 12:00:00",
                ]);
            }
            if ($type !== 'contractor') {
                EmployeeAsset::create([
                    'employee_id' => $e->id,
                    'name' => ['MacBook Pro 14"', 'Dell Latitude 7440', 'ThinkPad T14'][$i % 3],
                    'tag' => sprintf('LT-%04d', 200 + $i), 'assigned_on' => $joined, 'status' => 'assigned',
                ]);
            }
        }
        $teams['web']->update(['lead_employee_id' => $this->emp[103]->id]);
        $teams['design']->update(['lead_employee_id' => $this->emp[104]->id]);

        foreach (self::CHECKLIST as $k => $label) {
            OnboardingChecklistItem::create([
                'employee_id' => $this->emp[113]->id, 'label' => $label,
                'done' => $k < 4, 'done_at' => $k < 4 ? '2026-07-02 11:00:00' : null,
            ]);
        }

        $this->seedAttendance();

        // Leave balances for the current year (requests come with the Leave module seed).
        $year = (int) now()->year;
        foreach ($this->emp as $e) {
            foreach (LeaveType::all() as $t) {
                LeaveBalance::create([
                    'employee_id' => $e->id, 'leave_type_id' => $t->id, 'year' => $year,
                    'entitled' => $e->employment_type === 'contractor' ? 0 : $t->annual_quota, 'used' => 0, 'pending' => 0,
                ]);
            }
        }

        // Module demo seeders (owned by module agents; skipped until the class exists).
        foreach (['Work', 'Leave', 'Payroll', 'Billing', 'Inbox'] as $module) {
            $class = "Database\\Seeders\\{$module}DemoSeeder";
            if (class_exists($class)) {
                $this->call($class);
            }
        }
    }

    private function structure(string $employeeId, string $from, int $gross, string $type): array
    {
        if ($type === 'contractor') {
            return [
                'employee_id' => $employeeId, 'effective_from' => $from, 'basic' => 0, 'house_rent' => 0,
                'medical' => 0, 'conveyance' => 0, 'pf_percent' => 0, 'tax_monthly' => 0, 'gross' => 0,
                'hourly_rate' => $gross,
            ];
        }
        $basic = (int) round($gross * 0.55);
        $house = (int) round($gross * 0.25);
        $medical = (int) round($gross * 0.1);

        return [
            'employee_id' => $employeeId, 'effective_from' => $from,
            'basic' => $basic, 'house_rent' => $house, 'medical' => $medical,
            'conveyance' => $gross - $basic - $house - $medical,
            'pf_percent' => $type === 'full_time' ? 5 : 0,
            'tax_monthly' => $gross > 150000 ? (int) round($gross * 0.08) : ($gross > 90000 ? (int) round($gross * 0.04) : 0),
            'gross' => $gross,
            'hourly_rate' => (int) round($gross / 22 / 8),
        ];
    }

    // ---------------------------------------------------------------- attendance

    private function isWeekend(CarbonImmutable $d): bool
    {
        return in_array($d->dayOfWeek, $this->policy->weekend_days, true);
    }

    private function workdaysAgo(CarbonImmutable $today, int $k): string
    {
        $d = $today;
        $n = 0;
        while ($n < $k) {
            $d = $d->subDay();
            if (! $this->isWeekend($d) && ! isset($this->holidayDates[$d->toDateString()])) {
                $n++;
            }
        }

        return $d->toDateString();
    }

    private function seedAttendance(): void
    {
        $now = CarbonImmutable::now();
        $today = $now->startOfDay();

        // One recent company day off so history shows a holiday row.
        $k = 9;
        $d = $today->subDays($k);
        while ($this->isWeekend($d)) {
            $d = $today->subDays(++$k);
        }
        Holiday::firstOrCreate(['date' => $d->toDateString()], ['name' => 'Company day off']);
        $this->holidayDates = Holiday::pluck('date')->mapWithKeys(fn ($x) => [$x->toDateString() => true])->all();

        $forcedLate = [
            "109|{$this->workdaysAgo($today, 2)}" => 38,
            "113|{$this->workdaysAgo($today, 3)}" => 27,
            "107|{$this->workdaysAgo($today, 5)}" => 52,
            "114|{$this->workdaysAgo($today, 6)}" => 31,
            "109|{$this->workdaysAgo($today, 8)}" => 44,
        ];
        $todayState = [101 => 'not_started', 102 => 'not_started', 107 => 'not_started', 103 => 'on_break', 114 => 'on_break', 104 => 'ended', 109 => 'working', 113 => 'working'];
        $grace = $this->policy->grace_minutes;

        foreach ($this->emp as $n => $emp) {
            mt_srand($n * 104729 + 7919);
            $r = fn (int $lo, int $hi) => mt_rand($lo, $hi);
            $rand = fn () => mt_rand() / mt_getrandmax();
            $joined = $emp->joined_on->toDateString();

            for ($k = 30; $k >= 1; $k--) {
                $d = $today->subDays($k);
                $key = $d->toDateString();
                if ($key < $joined || $this->isWeekend($d)) {
                    continue;
                }
                if (isset($this->holidayDates[$key])) {
                    $this->addDay($emp, $key, 'holiday', [], 0, false, true, $now);

                    continue;
                }
                $roll = $rand();
                $forced = $forcedLate["{$n}|{$key}"] ?? null;
                if ($forced === null && $roll < 0.04) {
                    $this->addDay($emp, $key, 'absent', [], 0, false, true, $now);

                    continue;
                }
                if ($forced === null && $roll < 0.08) {
                    $this->addDay($emp, $key, 'on_leave', [], 0, false, true, $now);

                    continue;
                }
                $start = $d->setTimeFromTimeString($this->policy->shift_start);
                $delta = $forced ?? ($rand() < 0.78 ? $r(-25, $grace) : $r($grace + 3, 70));
                $inAt = $start->addMinutes($delta);
                $lunchLen = $rand() < 0.15 ? $r(66, 85) : $r(35, 60);
                $plan = [[$r(60, 100), $r(8, 18), 'tea'], [$r(170, 220), $lunchLen, 'lunch']];
                if ($rand() < 0.5) {
                    $plan[] = [$r(330, 380), $r(8, 15), 'short'];
                }
                $breaks = array_sum(array_column($plan, 1));
                $endAt = $inAt->addMinutes($this->policy->standard_minutes + $breaks + $r(-25, 50));
                $segs = $this->buildSegments($inAt, $plan, $now, $endAt);
                $late = $delta > $grace ? $delta : 0;
                $regularized = $late > 0 && $forced === null && $rand() < 0.35;
                $this->addDay($emp, $key, 'ended', $segs, $late, $regularized, true, $now);
            }

            // ----- today
            $tk = $today->toDateString();
            if ($this->isWeekend($today) || isset($this->holidayDates[$tk]) || $tk < $joined) {
                continue;
            }
            $state = $todayState[$n] ?? 'not_started';
            $start = $today->setTimeFromTimeString($this->policy->shift_start);
            if (($now->getTimestamp() - $start->getTimestamp()) / 60 < 15) {
                $state = 'not_started';
            }
            if ($state === 'not_started') {
                continue; // created on first sign-in
            }
            $inAt = $start->addMinutes($r(-18, 16));
            $latest = $now->subMinutes(8);
            if ($inAt > $latest) {
                $inAt = $latest;
            }
            $elapsed = ($now->getTimestamp() - $inAt->getTimestamp()) / 60;
            if ($state === 'ended' && $elapsed < 200) {
                $state = 'working';
            }
            if ($state === 'on_break' && $elapsed < 45) {
                $state = 'working';
            }
            $plan = [[$r(60, 90), $r(8, 15), 'tea'], [$r(150, 190), $r(35, 62), 'lunch']];
            $lateBy = (int) round(($inAt->getTimestamp() - $start->getTimestamp()) / 60);
            $late = $lateBy > $grace ? $lateBy : 0;
            if ($state === 'on_break') {
                $cats = ['tea', 'short', 'lunch', 'official'];
                $segs = $this->buildSegments($inAt, $plan, $now, null, [$now->subMinutes($r(4, 25)), $cats[$r(0, 3)]]);
            } elseif ($state === 'ended') {
                $segs = $this->buildSegments($inAt, $plan, $now, $now->subMinutes($r(6, 30)));
            } else {
                $segs = $this->buildSegments($inAt, $plan, $now);
            }
            $this->addDay($emp, $tk, $state, $segs, $late, false, $state === 'ended', $now);
            if ($state === 'working') {
                User::where('employee_id', $emp->id)->update(['last_seen_at' => $now]);
            }
        }

        // ----- regularization requests for the forced lates: 3 pending, 1 approved, 1 rejected
        $reasons = [
            'Traffic jam on the airport road, left home on time.',
            'Internet outage at home, joined as soon as it came back.',
            'Took my child to the clinic before work.',
            'Public transport strike this morning.',
            'Power cut and the lift was down, arrived late.',
        ];
        $i = 0;
        foreach ($forcedLate as $key => $delta) {
            [$n, $date] = explode('|', $key);
            $day = AttendanceDay::where('employee_id', $this->emp[(int) $n]->id)->whereDate('date', $date)->first();
            if (! $day) {
                continue;
            }
            $i++;
            $pending = $i <= 3;
            $approved = $i === 4;
            $req = RegularizationRequest::create([
                'attendance_day_id' => $day->id,
                'employee_id' => $day->employee_id,
                'reason' => $reasons[$i - 1],
                'status' => $pending ? 'pending' : ($approved ? 'approved' : 'rejected'),
                'decided_by' => $pending ? null : $this->emp[103]->id,
                'decided_at' => $pending ? null : CarbonImmutable::parse("{$date} 12:00:00")->addDay(),
                'note' => $pending ? null : ($approved ? 'Confirmed with the transport notice.' : 'No prior message to the team.'),
            ]);
            $req->created_at = CarbonImmutable::parse("{$date} 10:00:00")->addMinutes(24 * 60 + 5);
            $req->save();
            if ($approved) {
                $day->update(['is_regularized' => true]);
            }
        }

        // ----- graded days for Sadia this month: one unapproved absence and one auto-closed day (forgot to end).
        $sadia = $this->emp[107];
        foreach (['absent' => 1, 'auto_closed' => 3] as $kind => $ago) {
            $date = $this->workdaysAgo($today, $ago);
            if (substr($date, 0, 7) !== $today->format('Y-m')) {
                continue;
            }
            $old = AttendanceDay::where('employee_id', $sadia->id)->whereDate('date', $date)->first();
            if ($old) {
                TimeSegment::where('attendance_day_id', $old->id)->delete();
                $old->delete();
            }
            if ($kind === 'absent') {
                AttendanceDay::create([
                    'employee_id' => $sadia->id, 'date' => $date, 'status' => 'absent',
                    'day_fraction' => 0, 'absence_kind' => 'unapproved', 'closed_at' => CarbonImmutable::parse($date)->addDay()->setTime(0, 10),
                ]);

                continue;
            }
            $in = CarbonImmutable::parse("{$date} 10:04");
            $out = CarbonImmutable::parse("{$date} {$this->policy->shift_end}");
            $day = AttendanceDay::create([
                'employee_id' => $sadia->id, 'date' => $date, 'status' => 'ended',
                'first_in_at' => $in, 'last_out_at' => $out,
                'work_seconds' => $out->getTimestamp() - $in->getTimestamp(), 'break_seconds' => 0,
                'auto_closed' => true, 'closed_at' => CarbonImmutable::parse($date)->addDay()->setTime(0, 10),
            ]);
            TimeSegment::create([
                'attendance_day_id' => $day->id, 'type' => 'work', 'started_at' => $in, 'ended_at' => $out,
                'source' => 'manual', 'note' => 'auto-closed',
            ]);
        }
    }

    /**
     * Port of buildSegments(): work/break alternation from a plan of [offsetMin, lengthMin, category].
     *
     * @return list<array<string, mixed>>
     */
    private function buildSegments(CarbonImmutable $inAt, array $plan, CarbonImmutable $now, ?CarbonImmutable $endAt = null, ?array $openBreak = null): array
    {
        $limit = $openBreak[0] ?? $endAt ?? $now;
        $out = [];
        $cursor = $inAt;
        $push = function (string $type, $start, $end, ?string $cat, string $src) use (&$out) {
            $out[] = [
                'type' => $type, 'break_category' => $cat, 'started_at' => $start, 'ended_at' => $end,
                'note' => $cat === 'official' ? 'Client meeting' : null, 'source' => $src,
            ];
        };
        foreach ($plan as [$offset, $length, $cat]) {
            $bs = $inAt->addMinutes($offset);
            $be = $bs->addMinutes($length);
            if ($bs <= $cursor || $be > $limit->subMinutes(10)) {
                continue;
            }
            $push('work', $cursor, $bs, null, 'login');
            $push('break', $bs, $be, $cat, 'logout');
            $cursor = $be;
        }
        if ($openBreak) {
            $push('work', $cursor, $openBreak[0], null, 'login');
            $push('break', $openBreak[0], null, $openBreak[1], 'logout');
        } elseif ($endAt) {
            $push('work', $cursor, $endAt, null, 'login');
        } else {
            $push('work', $cursor, null, null, 'login');
        }

        return $out;
    }

    private function addDay(Employee $emp, string $date, string $status, array $segs, int $late, bool $regularized, bool $closed, CarbonImmutable $now): void
    {
        $sum = fn (string $type) => array_sum(array_map(
            fn ($s) => ($s['ended_at'] ?? $now)->getTimestamp() - $s['started_at']->getTimestamp(),
            array_filter($segs, fn ($s) => $s['type'] === $type),
        ));
        $last = $segs ? end($segs) : null;
        $day = AttendanceDay::create([
            'employee_id' => $emp->id,
            'date' => $date,
            'status' => $status,
            'first_in_at' => $segs[0]['started_at'] ?? null,
            'last_out_at' => $closed && $last ? $last['ended_at'] : null,
            'work_seconds' => $sum('work'),
            'break_seconds' => $sum('break'),
            'late_minutes' => $late,
            'is_regularized' => $regularized,
        ]);
        foreach ($segs as $s) {
            TimeSegment::create(['attendance_day_id' => $day->id, ...$s]);
        }
    }
}
