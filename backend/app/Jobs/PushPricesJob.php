<?php

namespace App\Jobs;

use App\Models\PriceListItem;
use App\Models\Store;
use App\Services\Catalogue\ChannelCatalogue;
use App\Services\Integrations\Contracts\SupportsPricePush;
use App\Services\Integrations\IntegrationFactory;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Sends a store its price list. Only stores that sell from a price list are touched, and
 * only on channels whose API can set a price.
 */
class PushPricesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public Store $store) {}

    public function handle(ChannelCatalogue $catalogue): void
    {
        $store = $this->store->fresh();
        if (! $store || ! $store->price_list_id || $store->status !== 'connected') {
            return;
        }
        $service = $this->getService($store);
        if (! $service instanceof SupportsPricePush) {
            return;
        }

        PriceListItem::where('price_list_id', $store->price_list_id)
            ->with('productVariant')
            ->chunkById(200, function ($items) use ($service, $store, $catalogue) {
                foreach ($items as $item) {
                    if (! $item->productVariant) {
                        continue;
                    }
                    try {
                        $service->updatePrice($store, $catalogue->channelSku($item->productVariant, $store), (float) $item->price);
                    } catch (\Throwable $e) {
                        Log::error("PushPricesJob failed for store {$store->id}, variant {$item->product_variant_id}: ".$e->getMessage());
                    }
                }
            });
    }

    protected function getService(Store $store)
    {
        return IntegrationFactory::make($store->platform);
    }
}
