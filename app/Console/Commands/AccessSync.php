<?php

namespace App\Console\Commands;

use App\Support\Access;
use Illuminate\Console\Command;

class AccessSync extends Command
{
    protected $signature = 'access:sync';

    protected $description = 'Create missing permissions and system roles, and assign each user the Spatie role from users.role (idempotent)';

    public function handle(): int
    {
        $s = Access::sync();
        $this->info("Permissions created: {$s['permissions']}, roles created: {$s['roles']}, users synced: {$s['users']}");

        return self::SUCCESS;
    }
}
