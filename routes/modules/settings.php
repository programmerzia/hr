<?php

// settings routes (P1.3). Included from routes/web.php inside auth + must-change-password.

use App\Http\Controllers\Settings\AttendancePolicyController;
use App\Http\Controllers\Settings\HolidayController;
use App\Http\Controllers\Settings\LeaveTypeController;
use App\Http\Controllers\Settings\PayrollPolicyController;
use App\Http\Controllers\Settings\SettingsController;
use Illuminate\Support\Facades\Route;

Route::middleware('can:manage_policy')->prefix('settings')->group(function () {
    Route::get('/', SettingsController::class)->name('settings');

    Route::controller(AttendancePolicyController::class)->prefix('attendance')->name('settings.attendance.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->name('store');
        Route::put('/{policy}', 'update')->name('update');
        Route::delete('/{policy}', 'destroy')->name('destroy');
    });

    Route::controller(PayrollPolicyController::class)->prefix('payroll')->name('settings.payroll.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->name('store');
        Route::put('/{policy}', 'update')->name('update');
        Route::delete('/{policy}', 'destroy')->name('destroy');
    });

    Route::controller(LeaveTypeController::class)->prefix('leave-types')->name('settings.leave-types.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->name('store');
        Route::put('/{leaveType}', 'update')->name('update');
        Route::delete('/{leaveType}', 'destroy')->name('destroy');
    });

    Route::controller(HolidayController::class)->prefix('holidays')->name('settings.holidays.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->name('store');
        Route::post('/bulk', 'bulk')->name('bulk');
        Route::delete('/{holiday}', 'destroy')->name('destroy');
    });
});
