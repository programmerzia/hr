<?php

use App\Http\Controllers\Attendance\MyDayController;
use App\Http\Controllers\Attendance\RegularizationController;
use App\Http\Controllers\Attendance\TeamController;
use App\Http\Controllers\Attendance\TeamHistoryController;
use Illuminate\Support\Facades\Route;

// Included from routes/web.php inside auth + must-change-password.
Route::name('attendance.')->group(function () {
    Route::get('/my-day', MyDayController::class)->name('my-day');
    Route::post('/regularizations', [RegularizationController::class, 'store'])->name('regularizations.store');

    Route::middleware('can:view_team')->group(function () {
        Route::get('/team', TeamController::class)->name('team');
        Route::get('/team/history', [TeamHistoryController::class, 'index'])->name('team.history');
        Route::get('/team/history/export', [TeamHistoryController::class, 'csv'])->name('team.history.csv');
        Route::get('/team/regularizations', [RegularizationController::class, 'index'])->name('regularizations');
        Route::post('/team/regularizations/decide', [RegularizationController::class, 'decide'])->name('regularizations.decide');
    });
});
