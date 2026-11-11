<?php

namespace App\Domain\Work\Actions;

use App\Models\Employee;
use App\Models\Task;
use App\Models\TaskLabel;
use Illuminate\Support\Facades\DB;

class UpdateTask
{
    private const PRIORITY = ['low' => 'Low', 'medium' => 'Medium', 'high' => 'High', 'urgent' => 'Urgent'];

    public function __construct(private LogTaskActivity $log) {}

    public function __invoke(Task $task, array $data, string $actorId): void
    {
        $notes = [];
        $has = fn (string $k) => array_key_exists($k, $data);
        $fields = [];

        if ($has('title') && trim((string) $data['title']) !== '') {
            if ($data['title'] !== $task->title) {
                $notes[] = 'changed the title';
            }
            $fields['title'] = trim($data['title']);
        }
        if ($has('body_md')) {
            $body = (string) $data['body_md'];
            if ($body !== $task->body_md) {
                $notes[] = 'edited the description';
            }
            $fields['body_md'] = $body;
        }
        if ($has('priority') && $data['priority'] !== $task->priority) {
            $notes[] = 'changed priority from '.self::PRIORITY[$task->priority].' to '.self::PRIORITY[$data['priority']];
            $fields['priority'] = $data['priority'];
        }
        if ($has('assignee_id') && $data['assignee_id'] !== $task->assignee_id) {
            $notes[] = $data['assignee_id']
                ? 'assigned the task to '.(Employee::find($data['assignee_id'])?->name ?? $data['assignee_id'])
                : 'unassigned the task';
            $fields['assignee_id'] = $data['assignee_id'];
        }
        if ($has('estimate_minutes') && $data['estimate_minutes'] !== $task->estimate_minutes) {
            $notes[] = $data['estimate_minutes'] === null ? 'cleared the estimate' : 'set the estimate to '.($data['estimate_minutes'] / 60).'h';
            $fields['estimate_minutes'] = $data['estimate_minutes'];
        }
        if ($has('due_on') && $data['due_on'] !== $task->due_on?->format('Y-m-d')) {
            $notes[] = $data['due_on'] ? "set the due date to {$data['due_on']}" : 'cleared the due date';
            $fields['due_on'] = $data['due_on'];
        }

        DB::transaction(function () use ($task, $data, $fields, $notes, $actorId, $has) {
            $task->update($fields);
            if ($has('label_ids')) {
                TaskLabel::where('task_id', $task->id)->delete();
                foreach (array_unique($data['label_ids'] ?? []) as $labelId) {
                    TaskLabel::create(['task_id' => $task->id, 'label_id' => $labelId]);
                }
                $notes[] = 'updated labels';
            }
            foreach ($notes as $n) {
                ($this->log)($task->id, $actorId, $n);
            }
        });
    }
}
