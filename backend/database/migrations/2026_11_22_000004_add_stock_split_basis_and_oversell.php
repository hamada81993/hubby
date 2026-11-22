<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            // split mode: divide by percentage of the stock, or by a fixed number of units per channel.
            $table->string('stock_split_basis', 8)->default('percent');
            // manual mode: whether a listing may offer more than is on the shelf.
            $table->boolean('allow_oversell')->default(false);
        });
        Schema::table('stores', fn (Blueprint $table) => $table->unsignedInteger('allocation_units')->nullable());
    }

    public function down(): void
    {
        Schema::table('stores', fn (Blueprint $table) => $table->dropColumn('allocation_units'));
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn(['stock_split_basis', 'allow_oversell']));
    }
};
