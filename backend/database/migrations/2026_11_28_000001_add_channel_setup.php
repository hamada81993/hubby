<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-store channel setup:
 *  - the market (country) a store sells in and the channel's own warehouse it stocks,
 *  - the product code a channel knows a variant by, when it differs from ours,
 *  - stock per warehouse and which warehouses feed which store,
 *  - price lists, and the one a store sells from.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_lists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('currency', 3)->nullable();
            // Set when the list is read from a connected system (Odoo) rather than typed here.
            $table->foreignId('source_store_id')->nullable()->constrained('stores')->nullOnDelete();
            $table->string('external_id', 64)->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'source_store_id', 'external_id']);
        });

        Schema::create('price_list_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('price_list_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->decimal('price', 12, 2);
            $table->timestamps();

            $table->unique(['price_list_id', 'product_variant_id']);
        });

        Schema::create('warehouse_stock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('warehouse_id');
            $table->foreign('warehouse_id')->references('id')->on('warehouses')->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->integer('quantity')->default(0);
            $table->timestamps();

            $table->unique(['warehouse_id', 'product_variant_id']);
        });

        Schema::create('store_warehouse', function (Blueprint $table) {
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('warehouse_id');
            $table->foreign('warehouse_id')->references('id')->on('warehouses')->cascadeOnDelete();

            $table->primary(['store_id', 'warehouse_id']);
        });

        Schema::table('stores', function (Blueprint $table) {
            // ISO country the store sells in (sa, ae, eg, tr…), for channels that span countries.
            $table->string('market', 2)->nullable();
            // The channel's own warehouse code stock is sent to (noon).
            $table->string('channel_warehouse', 64)->nullable();
            $table->foreignId('price_list_id')->nullable()->constrained('price_lists')->nullOnDelete();
        });

        Schema::table('platform_products', function (Blueprint $table) {
            // The code the channel knows this variant by, when it is not our SKU.
            $table->string('external_sku', 191)->nullable();
            $table->index(['store_id', 'external_sku']);
        });
    }

    public function down(): void
    {
        Schema::table('platform_products', function (Blueprint $table) {
            $table->dropIndex(['store_id', 'external_sku']);
            $table->dropColumn('external_sku');
        });
        Schema::table('stores', function (Blueprint $table) {
            $table->dropConstrainedForeignId('price_list_id');
            $table->dropColumn(['market', 'channel_warehouse']);
        });
        Schema::dropIfExists('store_warehouse');
        Schema::dropIfExists('warehouse_stock');
        Schema::dropIfExists('price_list_items');
        Schema::dropIfExists('price_lists');
    }
};
