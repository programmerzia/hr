<?php

// inbox routes: owned by the inbox module agent. Included from routes/web.php inside auth + must-change-password.

use App\Http\Controllers\Chat\ChatController;
use App\Http\Controllers\Inbox\InboxController;
use App\Http\Controllers\Settings\SettingsController;
use Illuminate\Support\Facades\Route;

Route::get('/inbox', [InboxController::class, 'index'])->name('inbox');
Route::post('/inbox/read', [InboxController::class, 'read'])->name('inbox.read');
Route::post('/inbox/read-all', [InboxController::class, 'readAll'])->name('inbox.read-all');

Route::get('/chat/{conversation?}', ChatController::class)->name('chat');
Route::get('/settings', SettingsController::class)->name('settings');
