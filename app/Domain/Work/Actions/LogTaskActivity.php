<?php

namespace App\Domain\Work\Actions;

use App\Models\TaskActivity;

class LogTaskActivity
{
    public function __invoke(string $taskId, string $actorId, string $text): void
    {
        TaskActivity::create(['task_id' => $taskId, 'actor_id' => $actorId, 'text' => $text, 'at' => now()]);
    }
}
