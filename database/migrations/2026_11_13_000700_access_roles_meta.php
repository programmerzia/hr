<?php

use App\Support\Access;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('label')->nullable()->after('name');
            $table->boolean('is_system')->default(false)->after('guard_name');
        });
        // Custom roles need users.role to be free text (was an enum of the built-in slugs).
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 40)->default('employee')->change();
        });
        Access::sync();
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(['label', 'is_system']);
        });
    }
};
