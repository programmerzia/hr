<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email');
            $table->text('address');
            $table->enum('currency', ['BDT', 'USD', 'EUR'])->default('BDT');
            $table->integer('default_rate')->default(0);
            $table->timestamps();
        });

        Schema::create('projects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('key');
            $table->string('name');
            $table->foreignUuid('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignUuid('lead_employee_id')->constrained('employees')->cascadeOnDelete();
            $table->enum('status', ['active', 'paused', 'done'])->default('active');
            $table->enum('billing_type', ['retainer', 'hourly', 'fixed', 'internal'])->default('retainer');
            $table->integer('rate')->nullable();
            $table->unique('key');
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('number');
            $table->foreignUuid('client_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignUuid('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->date('issued_on');
            $table->date('due_on');
            $table->enum('currency', ['BDT', 'USD', 'EUR'])->default('BDT');
            $table->integer('subtotal')->default(0);
            $table->decimal('tax_percent', 8, 2)->default(0);
            $table->integer('discount')->default(0);
            $table->integer('total')->default(0);
            $table->integer('paid_total')->default(0);
            $table->enum('status', ['draft', 'sent', 'paid', 'overdue', 'void'])->default('draft');
            $table->text('notes')->nullable();
            $table->string('pdf_path')->nullable();
            $table->unique('number');
            $table->timestamps();
        });

        Schema::create('invoice_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->string('description');
            $table->decimal('qty', 8, 2)->default(0);
            $table->integer('unit_price')->default(0);
            $table->integer('amount')->default(0);
            $table->timestamps();
        });

        Schema::create('invoice_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->date('paid_on');
            $table->integer('amount')->default(0);
            $table->string('method');
            $table->string('reference')->nullable();
            $table->timestamps();
        });

        Schema::create('contractor_claims', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->integer('year')->default(0);
            $table->integer('month')->default(0);
            $table->integer('tracked_minutes')->default(0);
            $table->integer('claimed_minutes')->default(0);
            $table->integer('rate')->default(0);
            $table->integer('fixed_amount')->nullable();
            $table->integer('total')->default(0);
            $table->enum('status', ['draft', 'submitted', 'verified', 'approved', 'paid'])->default('draft');
            $table->foreignUuid('verified_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignUuid('approved_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            $table->foreignUuid('bank_account_id')->nullable()->constrained('bank_accounts')->nullOnDelete();
            $table->string('pdf_path')->nullable();
            $table->unique(['employee_id', 'year', 'month']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contractor_claims');
        Schema::dropIfExists('invoice_payments');
        Schema::dropIfExists('invoice_lines');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('clients');
    }
};
