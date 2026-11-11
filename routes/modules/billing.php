<?php

// billing routes: owned by the billing module agent. Included from routes/web.php inside auth + must-change-password.

use App\Http\Controllers\Billing\ClaimController;
use App\Http\Controllers\Billing\ClientController;
use App\Http\Controllers\Billing\InvoiceController;
use Illuminate\Support\Facades\Route;

Route::middleware('can:manage_billing')->group(function () {
    Route::get('/clients', [ClientController::class, 'index'])->name('billing.clients');
    Route::post('/clients', [ClientController::class, 'store'])->name('billing.clients.store');
    Route::patch('/clients/{client}', [ClientController::class, 'update'])->name('billing.clients.update');

    Route::controller(InvoiceController::class)->prefix('invoices')->group(function () {
        Route::get('/', 'index')->name('billing.invoices');
        Route::get('/new', 'create')->name('billing.invoices.create');
        Route::post('/', 'store')->name('billing.invoices.store');
        Route::get('/{invoice}', 'show')->name('billing.invoices.show');
        Route::get('/{invoice}/print', 'print')->name('billing.invoices.print');
        Route::get('/{invoice}/edit', 'edit')->name('billing.invoices.edit');
        Route::patch('/{invoice}', 'update')->name('billing.invoices.update');
        Route::post('/{invoice}/send', 'send')->name('billing.invoices.send');
        Route::post('/{invoice}/payments', 'pay')->name('billing.invoices.payments.store');
        Route::post('/{invoice}/void', 'void')->name('billing.invoices.void');
    });
});

Route::controller(ClaimController::class)->prefix('claims')->group(function () {
    Route::get('/', 'index')->name('billing.claims');
    Route::post('/generate', 'generate')->name('billing.claims.generate');
    Route::get('/{claim}', 'show')->name('billing.claims.show');
    Route::get('/{claim}/print', 'print')->name('billing.claims.print');
    Route::patch('/{claim}', 'update')->name('billing.claims.update');
    Route::post('/{claim}/submit', 'submit')->name('billing.claims.submit');
    Route::post('/{claim}/verify', 'verify')->name('billing.claims.verify');
    Route::post('/{claim}/approve', 'approve')->name('billing.claims.approve');
    Route::post('/{claim}/pay', 'pay')->name('billing.claims.pay');
});
