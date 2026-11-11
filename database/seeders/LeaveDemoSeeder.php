<?php

namespace Database\Seeders;

use App\Domain\Leave\Services\BalanceService;
use App\Models\Employee;
use App\Models\LeaveApproval;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/** Requests in every state for the seeded people. Called by DemoSeeder after balances exist. */
class LeaveDemoSeeder extends Seeder
{
    public function run(): void
    {
        $bal = app(BalanceService::class);
        $type = fn (string $name) => LeaveType::where('name', $name)->firstOrFail();
        $emp = fn (string $name) => Employee::where('name', $name)->first();
        $hr = $emp('Nasrin Akter');
        $today = CarbonImmutable::now()->startOfDay();
        $sunday = $today->next(CarbonImmutable::SUNDAY);
        $d = fn (CarbonImmutable $c) => $c->format('Y-m-d');

        // name, type, from, to, half, reason, status, rejected stage, note, attachment
        $rows = [
            ['Sadia Sultana', 'Annual leave', '2026-02-15', '2026-02-19', 'none', 'Family trip to Sylhet', 'approved', null, null, null],
            ['Imran Kabir', 'Sick leave', '2026-03-08', '2026-03-09', 'none', 'Fever and cold', 'approved', null, null, 'medical-certificate.pdf'],
            ['Nusrat Jahan', 'Unpaid leave', '2026-04-12', '2026-04-12', 'first_half', 'Bank work in the morning', 'approved', null, null, null],
            ['Fahim Reza', 'Casual leave', '2026-09-06', '2026-09-07', 'none', 'Cousin wedding', 'rejected', 'hr', 'Intern attendance is low this month', null],
            ['Imran Kabir', 'Casual leave', $d($sunday->addWeeks(2)), $d($sunday->addWeeks(2)->addDay()), 'none', 'Moving to a new flat', 'cancelled', null, null, null],
            ['Sadia Sultana', 'Annual leave', $d($sunday->addWeeks(3)), $d($sunday->addWeeks(3)->addDays(3)), 'none', 'Visiting parents in Rajshahi', 'approved', null, null, null],
            ['Imran Kabir', 'Casual leave', $d($sunday->addWeek()), $d($sunday->addWeek()->addDay()), 'none', 'Cousin wedding in Comilla', 'pending_lead', null, null, null],
            ['Fahim Reza', 'Sick leave', $d($sunday->addWeeks(2)), $d($sunday->addWeeks(2)), 'second_half', 'Dentist appointment', 'pending_lead', null, null, null],
            ['Tanvir Hossain', 'Annual leave', $d($sunday->addWeeks(4)), $d($sunday->addWeeks(4)->addDays(2)), 'none', 'Family event', 'pending_hr', null, null, null],
        ];

        foreach ($rows as [$name, $typeName, $from, $to, $half, $reason, $status, $rejectedAt, $note, $attachment]) {
            $e = $emp($name);
            $t = $type($typeName);
            if (! $e) {
                continue;
            }
            $days = $bal->daysFor($from, $to, $half);
            if ($days <= 0) {
                continue;
            }
            $r = LeaveRequest::create([
                'employee_id' => $e->id, 'leave_type_id' => $t->id, 'starts_on' => $from, 'ends_on' => $to,
                'half_day' => $half, 'days' => $days, 'reason' => $reason,
                'attachment_path' => $attachment ? "/uploads/{$attachment}" : null,
                'status' => $status,
            ]);
            $r->forceFill(['created_at' => CarbonImmutable::parse($from)->subDays(5)->setTime(10, 15), 'updated_at' => now()])->saveQuietly();

            $team = $e->team_id ? Team::find($e->team_id) : null;
            $lead = $team && $team->lead_employee_id !== $e->id ? Employee::find($team->lead_employee_id) : null;
            $at = CarbonImmutable::parse($from)->subDays(4)->setTime(15, 30);
            $decide = fn (string $stage, Employee $by, string $decision, ?string $n = null, int $off = 0) => LeaveApproval::create([
                'leave_request_id' => $r->id, 'stage' => $stage, 'decided_by' => $by->id,
                'decision' => $decision, 'note' => $n, 'decided_at' => $at->addDays($off),
            ]);

            if ($status === 'approved') {
                $lead && $decide('lead', $lead, 'approved');
                $decide('hr', $hr, 'approved', null, 1);
                $bal->adjust($r, used: $days);
            } elseif ($status === 'rejected') {
                $lead && $decide('lead', $lead, 'approved');
                $decide('hr', $hr, 'rejected', $note, 1);
            } elseif ($status === 'pending_hr') {
                $lead && $decide('lead', $lead, 'approved');
                $bal->adjust($r, pending: $days);
            } elseif ($status === 'pending_lead') {
                $bal->adjust($r, pending: $days);
            }
        }
    }
}
