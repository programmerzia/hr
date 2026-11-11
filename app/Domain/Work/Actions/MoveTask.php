<?php

namespace App\Domain\Work\Actions;

use App\Models\BoardColumn;
use App\Models\Task;
use Illuminate\Support\Facades\DB;

class MoveTask
{
    public function __construct(private LogTaskActivity $log) {}

    /** Places the task at `$position` (0-based, end when null) of the target column and renumbers both columns. */
    public function __invoke(Task $task, BoardColumn $target, ?int $position, string $actorId): void
    {
        DB::transaction(function () use ($task, $target, $position, $actorId) {
            $from = $task->column_id;
            $ids = Task::where('column_id', $target->id)->where('id', '!=', $task->id)
                ->orderBy('position')->orderBy('number')->pluck('id')->all();
            $at = $position === null ? count($ids) : max(0, min($position, count($ids)));
            array_splice($ids, $at, 0, [$task->id]);

            $task->update(['column_id' => $target->id]);
            $this->renumber($ids);
            if ($from !== $target->id) {
                $this->renumber(Task::where('column_id', $from)->orderBy('position')->orderBy('number')->pluck('id')->all());
                $fromName = BoardColumn::find($from)?->name ?? '';
                ($this->log)($task->id, $actorId, "moved the task from {$fromName} to {$target->name}");
            }
        });
    }

    private function renumber(array $ids): void
    {
        foreach ($ids as $i => $id) {
            Task::where('id', $id)->update(['position' => $i]);
        }
    }
}
