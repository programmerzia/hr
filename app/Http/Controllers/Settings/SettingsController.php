<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function __invoke(): Response
    {
        abort_unless(Gate::allows('manage_settings'), 403);

        return Inertia::render('Settings/SettingsPage');
    }
}
