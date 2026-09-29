<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->string('email')->nullable();
            $t->unsignedInteger('lead_days')->default(14);
            $t->timestamps();
        });
        Schema::create('purchase_orders', function (Blueprint $t) {
            $t->id();
            $t->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $t->foreignId('supplier_id')->constrained();
            $t->string('reference', 100);
            $t->string('status')->default('draft');
            $t->char('currency', 3);
            $t->json('lines');
            $t->date('expected_at')->nullable();
            $t->foreignId('created_by')->constrained('users');
            $t->timestamps();
            $t->unique(['organization_id', 'reference']);
        });
        Schema::create('purchase_receipts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $t->uuid('request_id');
            $t->json('lines');
            $t->timestamps();
            $t->unique(['purchase_order_id', 'request_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_receipts');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('suppliers');
    }
};
