<?php

namespace App\Domain\Settings;

use App\Models\ActivityLogEntry;
use App\Models\User;
use Illuminate\Support\Str;

/** Audit trail for Settings changes (subject_type 'settings', area in properties). */
final class SettingsLog
{
    public static function record(?User $actor, string $area, string $text, array $properties = [], ?string $subjectId = null): ActivityLogEntry
    {
        return ActivityLogEntry::create([
            'subject_type' => 'settings', 'subject_id' => $subjectId ?? (string) Str::uuid(),
            'actor_id' => $actor?->employee_id, 'description' => $text,
            'properties' => ['area' => $area, ...$properties],
        ]);
    }

    /** Last changes for an area, shaped for HistoryPanel. @return list<array{at:string,actor:string,text:string}> */
    public static function recent(?string $area = null, int $limit = 10): array
    {
        return ActivityLogEntry::with('actor:id,name')->where('subject_type', 'settings')
            ->when($area, fn ($q) => $q->where('properties->area', $area))->latest()->limit($limit)->get()
            ->map(fn ($e) => ['at' => $e->created_at->toIso8601String(), 'actor' => $e->actor?->name ?? 'System', 'text' => $e->description])
            ->all();
    }
}
