<?php

// people routes: owned by the people module agent. Included from routes/web.php inside auth + must-change-password.

use App\Http\Controllers\People\DirectoryController;
use App\Http\Controllers\People\OnboardController;
use App\Http\Controllers\People\PasswordResetController;
use App\Http\Controllers\People\ProfileController;
use Illuminate\Support\Facades\Route;

Route::prefix('people')->name('people.')->group(function () {
    Route::get('/', [DirectoryController::class, 'index'])->name('directory');

    Route::middleware('can:manage_people')->group(function () {
        Route::get('/onboard', [OnboardController::class, 'create'])->name('onboard');
        Route::post('/', [OnboardController::class, 'store'])->name('store');
        Route::patch('/checklist/{item}', [ProfileController::class, 'toggleChecklist'])->name('checklist.toggle');
    });

    Route::middleware('can:manage_people')->group(function () {
        Route::post('/password-resets/{passwordReset}/approve', [PasswordResetController::class, 'approve'])->name('password-resets.approve');
        Route::post('/password-resets/{passwordReset}/reject', [PasswordResetController::class, 'reject'])->name('password-resets.reject');
    });

    Route::get('/{employee}', [ProfileController::class, 'show'])->name('profile');
    Route::get('/{employee}/documents/{document}', [ProfileController::class, 'downloadDocument'])->scopeBindings()->name('documents.download');

    Route::middleware('can:manage_people')->group(function () {
        Route::patch('/{employee}', [ProfileController::class, 'update'])->name('update');
        Route::post('/{employee}/status', [ProfileController::class, 'status'])->name('status');
        Route::post('/{employee}/salary', [ProfileController::class, 'salary'])->name('salary');
        Route::post('/{employee}/bank', [ProfileController::class, 'bank'])->name('bank');
        Route::post('/{employee}/documents', [ProfileController::class, 'document'])->name('documents');
        Route::post('/{employee}/assets', [ProfileController::class, 'asset'])->name('assets');
        Route::post('/{employee}/reset-password', [ProfileController::class, 'resetPassword'])->name('reset-password');
    });
});
