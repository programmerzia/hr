<?php

use App\Http\Controllers\Reports\ReportsController;
use Illuminate\Support\Facades\Route;

// Included from routes/web.php inside auth + must-change-password.
Route::middleware('can:view_reports')->prefix('reports')->name('reports.')->controller(ReportsController::class)->group(function () {
    Route::get('/', 'index')->name('index');
    Route::get('/payroll-summary.csv', 'summaryCsv')->name('summary.csv');
    Route::get('/department-cost.csv', 'departmentCsv')->name('department.csv');
    Route::get('/statement.csv', 'statementCsv')->name('statement.csv');
    Route::get('/attendance-sheet.csv', 'sheetCsv')->name('sheet.csv');
});

Route::get('/me/statement', [ReportsController::class, 'myStatement'])->name('me.statement');
Route::get('/me/statement.csv', [ReportsController::class, 'myStatementCsv'])->name('me.statement.csv');

Route::middleware('can:view_team')->group(function () {
    Route::get('/team/sheet', [ReportsController::class, 'teamSheet'])->name('team.sheet');
    Route::get('/team/sheet.csv', [ReportsController::class, 'teamSheetCsv'])->name('team.sheet.csv');
});
