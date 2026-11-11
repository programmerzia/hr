<?php

namespace App\Domain\Inbox\Support;

use App\Models\User;

final class Badges
{
    /** @return array{inbox:int} */
    public static function for(User $user): array
    {
        return ['inbox' => $user->unreadNotifications()->count()];
    }
}
