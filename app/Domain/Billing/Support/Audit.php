<?php

namespace App\Domain\Billing\Support;

use App\Models\ActivityLogEntry;

/** History entries for invoices and claims (ActivityLogEntry, subject_type `invoice` or `claim`). */
final class Audit
{
    public static function log(string $subjectType, string $subjectId, string $text, ?string $actorId, array $properties = []): ActivityLogEntry
    {
        return ActivityLogEntry::create([
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'actor_id' => $actorId,
            'description' => $text,
            'properties' => $properties ?: null,
        ]);
    }

    /** Newest first, shaped for HistoryPanel plus ids for the claim progress list. */
    public static function entries(string $subjectType, string $subjectId): array
    {
        return ActivityLogEntry::with('actor:id,name')
            ->where('subject_type', $subjectType)->where('subject_id', $subjectId)
            ->orderByDesc('created_at')->orderByDesc('id')->get()
            ->map(fn (ActivityLogEntry $e) => [
                'id' => $e->id,
                'at' => $e->created_at->copy()->setTimezone(config('app.timezone'))->toIso8601String(),
                'actor_id' => $e->actor_id,
                'actor' => $e->actor?->name ?? 'System',
                'text' => $e->description,
            ])->all();
    }
}
