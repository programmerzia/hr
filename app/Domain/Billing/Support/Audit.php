<?php

namespace App\Domain\Billing\Support;

use App\Models\ActivityLogEntry;
use App\Support\Audit as BaseAudit;

/** History entries for invoices and claims (subject_type `invoice` or `claim`). Delegates to App\Support\Audit. */
final class Audit
{
    public static function log(string $subjectType, string $subjectId, string $text, ?string $actorId, array $properties = []): ActivityLogEntry
    {
        return BaseAudit::record([$subjectType, $subjectId], $text, $actorId, $properties);
    }

    /** Newest first, shaped for HistoryPanel plus ids for the claim progress list. */
    public static function entries(string $subjectType, string $subjectId): array
    {
        return BaseAudit::entries([$subjectType, $subjectId]);
    }
}
