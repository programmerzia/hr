<?php

namespace App\Domain\Work\Actions;

use App\Models\Attachment;
use App\Models\Subtask;
use App\Models\Task;
use App\Models\TaskComment;
use Illuminate\Http\UploadedFile;

/** Subtasks, comments and attachments of a task. */
class TaskExtras
{
    public function __construct(private LogTaskActivity $log) {}

    public function addSubtask(Task $task, string $title, string $actorId): void
    {
        $title = trim($title);
        Subtask::create(['task_id' => $task->id, 'title' => $title, 'done' => false, 'position' => Subtask::where('task_id', $task->id)->count()]);
        ($this->log)($task->id, $actorId, "added subtask \"{$title}\"");
    }

    public function toggleSubtask(Subtask $sub, string $actorId): void
    {
        $was = $sub->done;
        $sub->update(['done' => ! $was]);
        ($this->log)($sub->task_id, $actorId, ($was ? 'reopened' : 'completed')." subtask \"{$sub->title}\"");
    }

    /** @param list<UploadedFile> $files */
    public function addComment(Task $task, ?string $body, array $files, string $actorId): TaskComment
    {
        $comment = TaskComment::create(['task_id' => $task->id, 'author_id' => $actorId, 'body' => trim((string) $body)]);
        ($this->log)($task->id, $actorId, 'commented');
        foreach ($files as $file) {
            $this->store($file, 'task_comment', $comment->id);
            ($this->log)($task->id, $actorId, "attached {$file->getClientOriginalName()}");
        }

        return $comment;
    }

    public function addAttachment(Task $task, UploadedFile $file, string $actorId): Attachment
    {
        $a = $this->store($file, 'task', $task->id);
        ($this->log)($task->id, $actorId, "attached {$a->name}");

        return $a;
    }

    private function store(UploadedFile $file, string $type, string $id): Attachment
    {
        return Attachment::create([
            'attachable_type' => $type,
            'attachable_id' => $id,
            'name' => $file->getClientOriginalName() ?: 'pasted-image.png',
            'mime' => $file->getClientMimeType() ?: 'application/octet-stream',
            'size' => $file->getSize(),
            'path' => $file->store('attachments', 'local'),
        ]);
    }
}
