<?php

namespace App\Domain\Attendance\Actions;

use App\Models\Employee;
use App\Models\RegularizationRequest;
use Illuminate\Support\Facades\DB;

/** Port of decideRegularization(): approving sets is_regularized (which clears the late mark). */
class DecideRegularization
{
    public function __invoke(RegularizationRequest $req, string $decision, ?string $note, Employee $decider): bool
    {
        if ($req->status !== 'pending') {
            return false;
        }
        DB::transaction(function () use ($req, $decision, $note, $decider) {
            $req->update([
                'status' => $decision,
                'decided_by' => $decider->id,
                'decided_at' => now(),
                'note' => trim((string) $note) ?: null,
            ]);
            if ($decision === 'approved') {
                $req->day()->update(['is_regularized' => true]);
            }
        });

        return true;
    }
}
