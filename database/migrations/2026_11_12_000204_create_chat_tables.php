<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->enum('type', ['dm', 'team', 'project', 'group'])->default('dm');
            $table->string('name')->nullable();
            $table->foreignUuid('team_id')->nullable()->constrained('teams')->nullOnDelete();
            $table->foreignUuid('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignUuid('author_id')->constrained('employees')->cascadeOnDelete();
            $table->text('body');
            $table->json('attachments');
            $table->timestamps();
        });

        Schema::create('conversation_members', function (Blueprint $table) {
            $table->foreignUuid('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignUuid('last_read_message_id')->nullable()->constrained('messages')->nullOnDelete();
            $table->primary(['conversation_id', 'employee_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_members');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
    }
};
