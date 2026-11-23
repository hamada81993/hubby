<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Where tax invoices are issued: here, or in the merchant's accounting system. Issuing
        // in both would give one sale two invoices, so it is one or the other.
        Schema::table('organizations', fn (Blueprint $table) => $table->string('invoice_source', 16)->default('hubby'));
    }

    public function down(): void
    {
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn('invoice_source'));
    }
};
