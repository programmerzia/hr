<?php

namespace App\Domain\Settings;

use App\Models\ActivityLogEntry;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Support\Str;

/** Audit trail for Settings changes (subject_type 'settings', area in properties). */
final class SettingsLog
{
    public static function record(?User $actor, string $area, string $text, array $properties = [], ?string $subjectId = null): ActivityLogEntry
    {
        return Audit::record(['settings', $subjectId ?? (string) Str::uuid()], $text, $actor?->employee_id, ['area' => $area, ...$properties]);
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
