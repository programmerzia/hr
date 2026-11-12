<?php

namespace App\Http\Controllers\Settings;

use App\Domain\Settings\SettingsLog;
use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('Settings/SettingsPage', ['history' => SettingsLog::recent()]);
    }
}
