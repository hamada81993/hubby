<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per organisation per requested integration: a vote for what to build next.
        Schema::create('integration_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('integration', 64);
            $table->timestamps();

            $table->unique(['organization_id', 'integration']);
            $table->index('integration');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('integration_requests');
    }
};
