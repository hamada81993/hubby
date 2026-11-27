<?php

use Illuminate\Support\Facades\Schedule;
use App\Jobs\RefreshTokenJob;
use App\Jobs\GenerateDailyAnalyticsJob;
use App\Jobs\SyncInventoryJob;
use App\Jobs\AmortizeExpensesJob;
use App\Jobs\SyncOrdersJob;
use App\Jobs\SyncProductsJob;
use App\Models\Store;

Schedule::job(new RefreshTokenJob)->hourly();
Schedule::job(new GenerateDailyAnalyticsJob)->dailyAt('00:00');
Schedule::job(new SyncInventoryJob)->everyFiveMinutes();
// Integrations are pulled over each platform's API on a schedule, never left to webhooks alone.
// Orders every minute: the closest an API pull gets to live.
Schedule::job(new SyncOrdersJob(null, null, null, true))->everyMinute();
// Products and prices hourly, from the master store only: pulling every channel would let each
// one overwrite the price in turn.
Schedule::call(fn () => Store::where('is_master', true)->each(fn ($store) => SyncProductsJob::dispatch($store)))
    ->hourly()->name('sync-master-products');
// Keep expense_allocations current so the P&L's operating-expenses line stays accurate (spec 01).
Schedule::job(new AmortizeExpensesJob)->dailyAt('00:15');
