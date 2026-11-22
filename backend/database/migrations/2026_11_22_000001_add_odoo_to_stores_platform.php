<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Widen the platform enum to include Odoo (a product source, not a sales channel).
        // Enum modification is MySQL-specific; sqlite (tests) already holds platform as a
        // plain string since the Trendyol migration.
        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE stores MODIFY platform "
                . "ENUM('shopify','salla','zid','woocommerce','amazon','noon','trendyol','odoo') NOT NULL"
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE stores MODIFY platform "
                . "ENUM('shopify','salla','zid','woocommerce','amazon','noon','trendyol') NOT NULL"
            );
        }
    }
};
