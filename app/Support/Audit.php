<?php

namespace App\Support;

use App\Models\ActivityLogEntry;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * The one writer for "who did what, when" (ActivityLogEntry). The subject is a model or a [type, id] pair.
 * With no actor given, the signed-in user is the actor; outside a request (scheduler) the entry is the system's.
 */
final class Audit
{
    private const TYPES = [LeaveRequest::class => 'leave_request', Employee::class => 'employee'];

    /** @param Model|array{0:string,1:string} $subject */
    public static function log(Model|array $subject, string $text, ?User $actor = null, array $props = []): ActivityLogEntry
    {
        $actor ??= auth()->user();

        return self::record($subject, $text, $actor?->employee_id, $props);
    }

    /** Same, with the actor given as an employee id (or null for the system). @param Model|array{0:string,1:string} $subject */
    public static function record(Model|array $subject, string $text, ?string $actorEmployeeId, array $props = []): ActivityLogEntry
    {
        [$type, $id] = self::key($subject);

        return ActivityLogEntry::create([
            'subject_type' => $type, 'subject_id' => $id, 'actor_id' => $actorEmployeeId,
            'description' => $text, 'properties' => $props ?: null,
        ]);
    }

    /** Newest first, shaped for HistoryPanel. @param Model|array{0:string,1:string} $subject */
    public static function entries(Model|array $subject): array
    {
        [$type, $id] = self::key($subject);

        return ActivityLogEntry::with('actor:id,name')->where('subject_type', $type)->where('subject_id', $id)
            ->orderByDesc('created_at')->orderByDesc('id')->get()
            ->map(fn (ActivityLogEntry $e) => self::shape($e))->all();
    }

    public static function shape(ActivityLogEntry $e): array
    {
        return [
            'id' => $e->id,
            'at' => $e->created_at->copy()->setTimezone(config('app.timezone'))->toIso8601String(),
            'actor_id' => $e->actor_id,
            'actor' => $e->actor?->name ?? 'System',
            'text' => $e->description,
        ];
    }

    /** @return array{0:string,1:string} */
    public static function key(Model|array $subject): array
    {
        if (is_array($subject)) {
            return [(string) $subject[0], (string) $subject[1]];
        }

        return [self::TYPES[$subject::class] ?? Str::snake(class_basename($subject)), (string) $subject->getKey()];
    }
}
