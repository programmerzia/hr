<?php

namespace App\Domain\People\Actions;

use App\Models\OnboardingChecklistItem;

class ToggleChecklistItem
{
    public function __invoke(OnboardingChecklistItem $item): OnboardingChecklistItem
    {
        $item->update(['done' => ! $item->done, 'done_at' => $item->done ? null : now()]);

        return $item;
    }
}
