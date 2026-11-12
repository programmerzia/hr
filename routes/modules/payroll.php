<?php

// payroll routes: owned by the payroll module agent. Included from routes/web.php inside auth + must-change-password.

use App\Http\Controllers\Payroll\AdjustmentController;
use App\Http\Controllers\Payroll\ItemController;
use App\Http\Controllers\Payroll\PayslipController;
use App\Http\Controllers\Payroll\RunController;
use Illuminate\Support\Facades\Route;

// Payslips are visible to their owner; everything else in payroll needs the manage/approve permission (policies add scope).
Route::prefix('payroll')->name('payroll.')->group(function () {
    Route::get('/items/{item}/payslip', [PayslipController::class, 'show'])->name('payslip');
    Route::get('/items/{item}/payslip.pdf', [PayslipController::class, 'pdf'])->name('payslip.pdf');
});

Route::middleware('can:payroll_staff')->prefix('payroll')->name('payroll.')->group(function () {
    Route::get('/', [RunController::class, 'index'])->name('runs');
    Route::post('/', [RunController::class, 'store'])->name('runs.store');
    Route::post('/items/{item}/adjustments', [AdjustmentController::class, 'store'])->name('adjustments.store');
    Route::post('/items/{item}/ack-variance', [ItemController::class, 'ackVariance'])->name('items.ack-variance');
    Route::post('/items/{item}/hold', [ItemController::class, 'hold'])->name('items.hold');
    Route::post('/items/{item}/unhold', [ItemController::class, 'unhold'])->name('items.unhold');
    Route::delete('/adjustments/{adjustment}', [AdjustmentController::class, 'destroy'])->name('adjustments.destroy');
    Route::get('/{run}', [RunController::class, 'show'])->name('runs.show');
    Route::delete('/{run}', [RunController::class, 'destroy'])->name('runs.destroy');
    Route::post('/{run}/recompute', [RunController::class, 'recompute'])->name('runs.recompute');
    Route::post('/{run}/submit', [RunController::class, 'submit'])->name('runs.submit');
    Route::post('/{run}/approve', [RunController::class, 'approve'])->name('runs.approve');
    Route::post('/{run}/reopen', [RunController::class, 'reopen'])->name('runs.reopen');
    Route::get('/{run}/bank-advice.csv', [RunController::class, 'bankAdvice'])->name('runs.bank-advice');
    Route::post('/{run}/pay', [RunController::class, 'pay'])->name('runs.pay');
});

Route::get('/payslips', [PayslipController::class, 'mine'])->name('payroll.mine');
