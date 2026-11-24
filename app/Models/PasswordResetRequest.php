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

    /** Accounts that manage people or access are privileged: only admins (manage_access) reset those. */
    public static function privileged(User $account): bool
    {
        return $account->checkPermissionTo('manage_people') || $account->checkPermissionTo('manage_access');
    }

    /** Whether this viewer may decide it: admins (manage_access) any; manage_people holders only non-privileged requesters. */
    public function decidableBy(User $viewer): bool
    {
        if ($this->status !== 'pending' || ! (self::privileged($viewer))) {
            return false;
        }
        if ($viewer->employee_id === $this->user->employee_id) {
            return false;
        }

        return $viewer->checkPermissionTo('manage_access') || ! self::privileged($this->user);
    }
}
