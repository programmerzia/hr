<?php

// leave routes: owned by the leave module agent. Included from routes/web.php inside auth + must-change-password.

use App\Http\Controllers\Leave\ApprovalController;
use App\Http\Controllers\Leave\CalendarController;
use App\Http\Controllers\Leave\MyLeaveController;
use App\Http\Controllers\Leave\PolicyController;
use Illuminate\Support\Facades\Route;

Route::prefix('leave')->name('leave.')->group(function () {
    Route::get('/', [MyLeaveController::class, 'index'])->name('mine');
    Route::post('/', [MyLeaveController::class, 'store'])->name('store');
    Route::get('/approvals', [ApprovalController::class, 'index'])->name('approvals');
    Route::get('/calendar', [CalendarController::class, 'index'])->name('calendar');
    Route::get('/policy', [PolicyController::class, 'index'])->name('policy');
    Route::patch('/types/{leaveType}', [PolicyController::class, 'update'])->name('types.update');
    Route::post('/{leaveRequest}/cancel', [MyLeaveController::class, 'cancel'])->name('cancel');
    Route::post('/{leaveRequest}/approve', [ApprovalController::class, 'approve'])->name('approve');
    Route::post('/{leaveRequest}/reject', [ApprovalController::class, 'reject'])->name('reject');
});
