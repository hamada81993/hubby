<?php

namespace App\Services\Catalogue;

use App\Models\PlatformProduct;
use App\Models\PriceListItem;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\WarehouseStock;

/**
 * What a variant looks like from one store's side: the code the channel knows it by, the
 * price it sells at there, and how much stock that store may draw on.
 */
class ChannelCatalogue
{
    /** The channel's code for a variant: the linked one, or our SKU when none is set. */
    public function channelSku(ProductVariant $variant, Store $store): string
    {
        $linked = PlatformProduct::where('store_id', $store->id)
            ->where('product_variant_id', $variant->id)
            ->value('external_sku');

        return filled($linked) ? (string) $linked : (string) $variant->sku;
    }

    /** Our SKU for a code a channel sent (in an order line), or the code itself when unlinked. */
    public function localSku(Store $store, ?string $channelSku): ?string
    {
        if (! filled($channelSku)) {
            return $channelSku;
        }
        $ours = PlatformProduct::where('store_id', $store->id)
            ->where('external_sku', $channelSku)
            ->first()?->productVariant?->sku;

        return $ours ?? $channelSku;
    }

    /** The price a store sells a variant at: its price list's, or the product's own. */
    public function priceFor(ProductVariant $variant, Store $store): float
    {
        if ($store->price_list_id) {
            $listed = PriceListItem::where('price_list_id', $store->price_list_id)
                ->where('product_variant_id', $variant->id)
                ->value('price');
            if ($listed !== null) {
                return (float) $listed;
            }
        }

        return (float) $variant->price;
    }

    /**
     * Units a store may draw on: the stock of the warehouses assigned to it, or the whole
     * stock when none are assigned.
     */
    public function stockFor(ProductVariant $variant, Store $store): int
    {
        $warehouses = $store->warehouses()->pluck('warehouses.id');
        if ($warehouses->isEmpty()) {
            return max(0, (int) $variant->stock);
        }

        return max(0, (int) WarehouseStock::whereIn('warehouse_id', $warehouses)
            ->where('product_variant_id', $variant->id)
            ->sum('quantity'));
    }
}
