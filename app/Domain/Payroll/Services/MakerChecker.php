<?php

namespace App\Domain\Payroll\Services;

use App\Models\Employee;
use App\Models\PayrollRun;
use App\Models\Setting;

/** Maker-checker rules: whoever prepared, submitted or changed a run cannot approve it (unless one-person mode is on). */
final class MakerChecker
{
    public const SETTING = 'payroll.allow_single_approver';

    public static function singleApproverAllowed(): bool
    {
        return (bool) (Setting::find(self::SETTING)?->value['on'] ?? false);
    }

    public static function setSingleApprover(bool $on): void
    {
        Setting::updateOrCreate(['key' => self::SETTING], ['value' => ['on' => $on]]);
    }

    /** Why this employee must not approve, ignoring the one-person switch. */
    public static function conflict(PayrollRun $run, Employee $by): ?string
    {
        if ($run->submitted_by === $by->id) {
            return 'You submitted this run for review.';
        }
        if ($run->prepared_by === $by->id) {
            return 'You prepared this run.';
        }
        if (in_array($by->id, (array) $run->review_editors, true)) {
            return 'You changed this run after it was submitted.';
        }

        return null;
    }

    /** Reason approval is blocked for this person, or null when allowed. */
    public static function blockReason(PayrollRun $run, Employee $by): ?string
    {
        return self::singleApproverAllowed() ? null : self::conflict($run, $by);
    }

    /** Records that someone changed a run that is in review. */
    public static function noteChange(PayrollRun $run, Employee $by): void
    {
        if ($run->status !== 'review') {
            return;
        }
        $ids = (array) $run->review_editors;
        if (! in_array($by->id, $ids, true)) {
            $ids[] = $by->id;
            $run->forceFill(['review_editors' => $ids])->save();
        }
    }
}
