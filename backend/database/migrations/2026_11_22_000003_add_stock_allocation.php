<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // How an organisation's stock is offered to its sales channels. `shared` is the
        // behaviour every organisation already has, so nothing changes until a merchant opts in.
        Schema::table('organizations', fn (Blueprint $table) => $table->string('stock_allocation_mode', 16)->default('shared'));
        // split mode: this channel's share of the stock, in percent.
        Schema::table('stores', fn (Blueprint $table) => $table->unsignedTinyInteger('allocation_percent')->nullable());
        // manual mode: the quantity the merchant chose to offer for this listing.
        Schema::table('platform_products', fn (Blueprint $table) => $table->unsignedInteger('allocated_quantity')->nullable());
    }

    public function down(): void
    {
        Schema::table('platform_products', fn (Blueprint $table) => $table->dropColumn('allocated_quantity'));
        Schema::table('stores', fn (Blueprint $table) => $table->dropColumn('allocation_percent'));
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn('stock_allocation_mode'));
    }
};
