<?php

namespace Database\Seeders;

use App\Domain\Work\Actions\CreateProject;
use App\Models\BoardColumn;
use App\Models\Client;
use App\Models\Employee;
use App\Models\Label;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Subtask;
use App\Models\Task;
use App\Models\TaskActivity;
use App\Models\TaskComment;
use App\Models\TaskLabel;
use App\Models\TaskTimeEntry;
use App\Models\TimeSegment;
use Illuminate\Database\Seeder;

/** Port of resources/js/mock/db/work.ts for PULSE and ERP, plus task time entries linked to existing work segments. */
class WorkDemoSeeder extends Seeder
{
    private const LABELS = [
        ['bug', 'danger'], ['feature', 'info'], ['design', 'accent'], ['qa', 'warning'],
        ['tech debt', 'neutral'], ['blocked', 'danger'], ['docs', 'neutral'],
    ];

    /** title, column index, priority, assignee code, estimate hours, due in days, labels, subtasks */
    private const ROWS = [
        'PULSE' => [
            ['Fix crash when opening notifications on Android 13', 3, 'urgent', 113, 4, -2, ['bug'], ['Reproduce on Pixel 6', 'Guard null payload', 'Add regression test']],
            ['Biometric login for returning users', 2, 'high', 107, 12, 5, ['feature'], ['Keychain storage', 'Fallback to PIN', 'Settings toggle']],
            ['Offline cache for shipment list', 2, 'medium', 109, 10, 9, ['feature']],
            ['Design empty states for tracking screen', 1, 'medium', 107, 6, 4, ['design']],
            ['Upgrade React Native to 0.76', 0, 'low', null, 16, null, ['tech debt']],
            ['Push notification deep links', 3, 'high', 114, 8, 1, ['feature'], ['Parse link scheme', 'Cold start handling']],
            ['Regression pass for release 2.4', 2, 'high', 114, 10, 3, ['qa']],
            ['Map pin clustering is slow with 500 markers', 4, 'medium', 109, 6, -6, ['bug']],
            ['Add dark theme to settings screen', 4, 'low', 114, 3, -10, ['design']],
            ['Analytics events for onboarding funnel', 1, 'medium', 113, 5, 12, ['feature']],
            ['Write API error handling guide', 0, 'low', 107, 4, null, ['docs']],
            ['Session token refresh fails after airplane mode', 2, 'urgent', 107, 5, 0, ['bug', 'blocked']],
        ],
        'ERP' => [
            ['Barcode scanner support in goods receipt', 2, 'high', 107, 14, 6, ['feature'], ['Scanner driver', 'Receipt line matching', 'Error sounds']],
            ['Stock transfer between warehouses', 1, 'high', 109, 20, 14, ['feature']],
            ['Inventory report times out for 50k SKUs', 3, 'urgent', 109, 8, -1, ['bug'], ['Add index on sku_id', 'Paginate export']],
            ['Migrate purchase order PDFs to queue worker', 2, 'medium', 114, 10, 8, ['tech debt']],
            ['Role permissions matrix for store managers', 1, 'medium', 107, 9, 11, ['feature']],
            ['Test plan for cycle count module', 4, 'medium', 113, 6, -8, ['qa']],
            ['Automate smoke tests for goods receipt', 3, 'medium', 114, 12, 2, ['qa']],
            ['Supplier lead time calculation is off by one day', 4, 'high', 109, 3, -12, ['bug']],
            ['Document stock valuation rules', 0, 'low', null, 5, null, ['docs']],
            ['Replace legacy date picker', 0, 'low', 113, 4, null, ['tech debt']],
        ],
    ];

    private const COMMENTS = [
        ['PULSE-1', 103, 'This looks related to PULSE-12, same token path. Check both together.', 30],
        ['PULSE-1', 113, 'Reproduced on the emulator. Payload is null when the app is cold started from a tray tap.', 20],
        ['PULSE-12', 107, 'Blocked until the staging auth service is fixed. See ERP-3 for the shared logging change.', 9],
        ['ERP-3', 109, 'Added the index, export is down from 40s to 6s. Still need pagination.', 8],
        ['ERP-3', 103, 'Good. Please also check ERP-8 since it uses the same query.', 5],
    ];

    public function run(): void
    {
        if (Project::where('key', 'PULSE')->exists()) {
            return;
        }
        $emp = Employee::all()->keyBy(fn ($e) => (int) substr($e->code, 4));
        $tanvir = $emp[103];

        $labels = [];
        foreach (self::LABELS as [$name, $color]) {
            $labels[$name] = Label::firstOrCreate(['name' => $name, 'project_id' => null], ['color' => $color])->id;
        }
        $clients = [
            'PULSE' => Client::firstOrCreate(['name' => 'Northwind Logistics'], ['email' => 'accounts@northwind.example', 'address' => '12 Harbour Road, Chattogram', 'currency' => 'USD', 'default_rate' => 30]),
            'ERP' => Client::firstOrCreate(['name' => 'Harbor Health'], ['email' => 'finance@harborhealth.example', 'address' => '48 Lake Drive, Dhaka', 'currency' => 'USD', 'default_rate' => 35]),
        ];
        $members = ['PULSE' => [103, 107, 109, 113, 114], 'ERP' => [103, 107, 109, 113, 114]];

        $create = app(CreateProject::class);
        foreach ([['PULSE', 'Pulse mobile app', 'retainer', null], ['ERP', 'Warehouse ERP', 'hourly', 35]] as [$key, $name, $billing, $rate]) {
            $project = $create([
                'key' => $key, 'name' => $name, 'billing_type' => $billing,
                'client_id' => $clients[$key]->id, 'lead_employee_id' => $tanvir->id,
            ]);
            $project->update(['rate' => $rate]);
            foreach ($members[$key] as $code) {
                ProjectMember::firstOrCreate(['project_id' => $project->id, 'employee_id' => $emp[$code]->id]);
            }
            $columns = $project->id ? BoardColumn::where('project_id', $project->id)->orderBy('position')->pluck('id')->all() : [];
            $positions = [];
            foreach (self::ROWS[$key] as $i => $r) {
                [$title, $col, $priority, $assignee, $hours, $due, $lbls] = $r;
                $subs = $r[7] ?? [];
                $created = now()->subHours(24 * (count(self::ROWS[$key]) - $i) + 3);
                $positions[$col] = ($positions[$col] ?? -1) + 1;
                $task = Task::create([
                    'project_id' => $project->id, 'number' => $i + 1, 'title' => $title,
                    'body_md' => "Scope for this task:\n\n- Implement the change behind a flag\n- Update the **acceptance checks**\n- Notify QA when ready for review",
                    'column_id' => $columns[$col], 'priority' => $priority,
                    'assignee_id' => $assignee ? $emp[$assignee]->id : null, 'reporter_id' => $tanvir->id,
                    'estimate_minutes' => $hours * 60, 'due_on' => $due === null ? null : now()->addDays($due)->toDateString(),
                    'position' => $positions[$col], 'created_at' => $created, 'updated_at' => $created,
                ]);
                foreach ($lbls as $l) {
                    TaskLabel::create(['task_id' => $task->id, 'label_id' => $labels[$l]]);
                }
                foreach ($subs as $si => $s) {
                    Subtask::create(['task_id' => $task->id, 'title' => $s, 'done' => $col === 4 || $si === 0, 'position' => $si]);
                }
                $act = fn (string $text, $at, $actor) => TaskActivity::create(['task_id' => $task->id, 'actor_id' => $actor, 'text' => $text, 'at' => $at]);
                $act('created the task', $created, $tanvir->id);
                if ($assignee) {
                    $act('assigned the task to '.$emp[$assignee]->name, $created->copy()->addMinutes(5), $tanvir->id);
                }
                if ($col > 1) {
                    $act('moved the task from To do to '.BoardColumn::find($columns[$col])->name, now()->subHours(6 + $i), $assignee ? $emp[$assignee]->id : $tanvir->id);
                }
            }
        }

        foreach (self::COMMENTS as [$key, $author, $body, $hoursAgo]) {
            [$pk, $n] = explode('-', $key);
            $task = Task::where('number', (int) $n)->whereIn('project_id', Project::where('key', $pk)->select('id'))->first();
            $at = now()->subHours($hoursAgo);
            TaskComment::create(['task_id' => $task->id, 'author_id' => $emp[$author]->id, 'body' => $body, 'created_at' => $at, 'updated_at' => $at]);
        }

        $this->timeEntries([107, 109, 114], $emp);
    }

    /** Work segments of the last 30 days, linked to the person's open tasks in rotation. */
    private function timeEntries(array $codes, $emp): void
    {
        foreach ($codes as $code) {
            $e = $emp[$code];
            $tasks = Task::where('assignee_id', $e->id)->orderBy('number')->get();
            if ($tasks->isEmpty()) {
                continue;
            }
            $segments = TimeSegment::where('type', 'work')->whereNotNull('ended_at')
                ->where('started_at', '>=', now()->subDays(30))
                ->whereHas('day', fn ($q) => $q->where('employee_id', $e->id))
                ->orderBy('started_at')->get();
            foreach ($segments as $i => $seg) {
                TaskTimeEntry::create([
                    'time_segment_id' => $seg->id,
                    'task_id' => $tasks[$i % $tasks->count()]->id,
                    'employee_id' => $e->id,
                    'started_at' => $seg->started_at,
                    'ended_at' => $seg->ended_at,
                    'seconds' => max(0, $seg->ended_at->diffInSeconds($seg->started_at, true)),
                ]);
            }
        }
    }
}
