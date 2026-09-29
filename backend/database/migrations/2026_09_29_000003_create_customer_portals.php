<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_portals', function (Blueprint $t) {
            $t->id();
            $t->foreignId('order_id')->constrained()->cascadeOnDelete();
            $t->char('token_hash', 64)->unique();
            $t->timestamp('expires_at');
            $t->timestamps();
        });
        Schema::create('portal_requests', function (Blueprint $t) {
            $t->id();
            $t->foreignId('customer_portal_id')->constrained()->cascadeOnDelete();
            $t->uuid('request_id');
            $t->foreignId('return_request_id')->constrained();
            $t->timestamps();
            $t->unique(['customer_portal_id', 'request_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portal_requests');
        Schema::dropIfExists('customer_portals');
    }
};
