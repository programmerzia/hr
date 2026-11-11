<?php

// work routes: projects, boards, tasks. Included from routes/web.php inside auth + must-change-password.

use App\Http\Controllers\Work\BoardController;
use App\Http\Controllers\Work\MyTasksController;
use App\Http\Controllers\Work\ProjectController;
use App\Http\Controllers\Work\TaskController;
use Illuminate\Support\Facades\Route;

Route::name('work.')->group(function () {
    Route::get('/projects', [ProjectController::class, 'index'])->name('projects');
    Route::post('/projects', [ProjectController::class, 'store'])->name('projects.store');
    Route::get('/projects/{project:key}', [BoardController::class, 'show'])->name('project');
    Route::get('/projects/{project:key}/board', [BoardController::class, 'board'])->name('board');
    Route::get('/projects/{project:key}/list', [BoardController::class, 'list'])->name('list');
    Route::patch('/projects/{project:key}', [ProjectController::class, 'update'])->name('projects.update');
    Route::post('/projects/{project:key}/members', [ProjectController::class, 'addMember'])->name('projects.members.add');
    Route::delete('/projects/{project:key}/members/{employee}', [ProjectController::class, 'removeMember'])->name('projects.members.remove');
    Route::post('/projects/{project:key}/columns', [ProjectController::class, 'addColumn'])->name('projects.columns.add');
    Route::post('/projects/{project:key}/columns/reorder', [ProjectController::class, 'reorderColumns'])->name('projects.columns.reorder');
    Route::patch('/columns/{column}', [ProjectController::class, 'renameColumn'])->name('columns.update');

    // "/tasks" is the sidebar link; "/my-tasks" is the canonical name.
    Route::get('/my-tasks', MyTasksController::class)->name('my-tasks');
    Route::get('/tasks', MyTasksController::class)->name('tasks.index');
    Route::post('/tasks', [TaskController::class, 'store'])->name('tasks.store');
    Route::patch('/tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
    Route::post('/tasks/{task}/move', [TaskController::class, 'move'])->name('tasks.move');
    Route::post('/tasks/{task}/subtasks', [TaskController::class, 'addSubtask'])->name('tasks.subtasks.store');
    Route::post('/subtasks/{subtask}/toggle', [TaskController::class, 'toggleSubtask'])->name('subtasks.toggle');
    Route::post('/tasks/{task}/comments', [TaskController::class, 'comment'])->name('tasks.comments');
    Route::post('/tasks/{task}/attachments', [TaskController::class, 'attach'])->name('tasks.attachments');
    Route::get('/attachments/{attachment}', [TaskController::class, 'download'])->name('attachments.download');
});
