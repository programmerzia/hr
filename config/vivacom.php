<?php

return [
    // ProductionSeeder: the first HR account (forced password change at first sign-in).
    'seed_admin_email' => env('SEED_ADMIN_EMAIL'),
    'seed_admin_password' => env('SEED_ADMIN_PASSWORD'),
    'seed_admin_name' => env('SEED_ADMIN_NAME', 'HR administrator'),
];
