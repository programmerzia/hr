<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_members', function (Blueprint $table) {
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->primary(['project_id', 'employee_id']);
        });

        Schema::create('board_columns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('name');
            $table->integer('position')->default(0);
            $table->boolean('is_done')->default(false);
            $table->timestamps();
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->integer('number')->default(0);
            $table->string('title');
            $table->longText('body_md');
            $table->foreignUuid('column_id')->constrained('board_columns')->cascadeOnDelete();
            $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('low');
            $table->foreignUuid('assignee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignUuid('reporter_id')->constrained('employees')->cascadeOnDelete();
            $table->integer('estimate_minutes')->nullable();
            $table->date('due_on')->nullable();
            $table->integer('position')->default(0);
            $table->unique(['project_id', 'number']);
            $table->timestamps();
        });

        Schema::create('labels', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->string('name');
            $table->enum('color', ['neutral', 'success', 'warning', 'danger', 'info', 'accent'])->default('neutral');
            $table->timestamps();
        });

        Schema::create('task_labels', function (Blueprint $table) {
            $table->foreignUuid('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignUuid('label_id')->constrained('labels')->cascadeOnDelete();
            $table->primary(['task_id', 'label_id']);
        });

        Schema::create('subtasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->string('title');
            $table->boolean('done')->default(false);
            $table->integer('position')->default(0);
            $table->timestamps();
        });

        Schema::create('task_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignUuid('author_id')->constrained('employees')->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->enum('attachable_type', ['task', 'task_comment', 'message', 'leave_request'])->default('task');
            $table->uuid('attachable_id')->index();
            $table->string('name');
            $table->string('mime');
            $table->integer('size')->default(0);
            $table->string('path');
            $table->timestamps();
        });

        Schema::create('task_activity', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignUuid('actor_id')->constrained('employees')->cascadeOnDelete();
            $table->string('text');
            $table->timestamp('at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_activity');
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('task_comments');
        Schema::dropIfExists('subtasks');
        Schema::dropIfExists('task_labels');
        Schema::dropIfExists('labels');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('board_columns');
        Schema::dropIfExists('project_members');
    }
};
