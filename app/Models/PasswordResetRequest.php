<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PasswordResetRequest extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['requested_at' => 'datetime', 'decided_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'decided_by');
    }

    /** Pending requests older than 48 hours lapse. */
    public static function expireStale(): void
    {
        static::where('status', 'pending')->where('requested_at', '<', now()->subHours(48))->update(['status' => 'expired']);
    }

    /** Whether this viewer may decide it: management any; HR only employee and team lead requesters. */
    public function decidableBy(User $viewer): bool
    {
        if ($this->status !== 'pending' || ! in_array($viewer->role, ['hr', 'management'], true)) {
            return false;
        }
        if ($viewer->employee_id === $this->user->employee_id) {
            return false;
        }

        return $viewer->role === 'management' || in_array($this->user->role, ['employee', 'team_lead'], true);
    }
}
