<?php

namespace Database\Seeders;

use App\Support\Access;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(app()->isProduction() ? ProductionSeeder::class : DemoSeeder::class);
        Access::sync();
    }
}
