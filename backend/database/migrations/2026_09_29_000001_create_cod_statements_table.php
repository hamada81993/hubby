<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cod_statements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->string('carrier_code', 50);
            $table->string('reference', 100);
            $table->string('status')->default('preview');
            $table->json('rows');
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'carrier_code', 'reference']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cod_statements');
    }
};
