<?php

use App\Http\Controllers\Account\PasswordController;
use App\Http\Controllers\Attendance\AttendanceController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'create'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->name('login.store');
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
    Route::post('/heartbeat', [AttendanceController::class, 'heartbeat'])->name('heartbeat');

    Route::get('/account/password', [PasswordController::class, 'edit'])->name('account.password');
    Route::post('/account/password', [PasswordController::class, 'update'])->name('account.password.update');

    Route::middleware('must-change-password')->group(function () {
        Route::get('/', HomeController::class)->name('home');

        Route::prefix('attendance')->name('attendance.')->controller(AttendanceController::class)->group(function () {
            Route::post('/break', 'break')->name('break');
            Route::post('/resume', 'resume')->name('resume');
            Route::post('/end-day', 'endDay')->name('end-day');
            Route::post('/current-task', 'currentTask')->name('current-task');
        });
        foreach (['attendance', 'people', 'work', 'leave', 'payroll', 'billing', 'inbox', 'settings', 'reports'] as $module) {
            require __DIR__."/modules/{$module}.php";
        }
    });
});
