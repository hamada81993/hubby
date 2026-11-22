<?php

namespace App\Services\Inventory;

use App\Models\PlatformProduct;
use App\Models\ProductVariant;
use App\Models\Store;
use Illuminate\Support\Collection;

/**
 * Decides how many units of a variant each sales channel is told it can sell.
 *
 *  - shared: every channel is offered the whole stock (less its safety stock). One sale
 *    lowers the number everywhere on the next push.
 *  - split:  the stock is divided between channels by percentage, so the channels together
 *    never offer more than is on the shelf.
 *  - manual: the merchant sets a quantity per listing, above or below the real stock;
 *    listings without one behave as in `shared`.
 *
 * The master store is the source of the number and always keeps the full quantity.
 */
class StockAllocator
{
    public const MODES = ['shared', 'split', 'manual'];

    /** Stores that are a product source rather than a place stock is sold. */
    public const SOURCES = ['odoo'];

    /**
     * @param  Collection<int, Store>  $channels  every connected store of the organisation
     */
    public function quantityFor(ProductVariant $variant, Store $store, string $mode, Collection $channels): int
    {
        $stock = max(0, (int) $variant->stock);
        if ($store->is_master) {
            return $stock;
        }

        if ($mode === 'manual') {
            $chosen = PlatformProduct::where('store_id', $store->id)
                ->where('product_variant_id', $variant->id)
                ->value('allocated_quantity');
            if ($chosen !== null) {
                return (int) $chosen;
            }
        }

        if ($mode === 'split') {
            return (int) floor($stock * $this->shareOf($store, $channels) / 100);
        }

        return max(0, $stock - (int) $store->safety_stock);
    }

    /** A channel's share in percent: what the merchant set, or an even split when nothing is set. */
    public function shareOf(Store $store, Collection $channels): float
    {
        $selling = $channels->filter(fn (Store $s) => ! $s->is_master && ! in_array($s->platform, self::SOURCES, true));
        if (! $selling->contains('id', $store->id)) {
            return 0;
        }
        if ($selling->contains(fn (Store $s) => $s->allocation_percent !== null)) {
            return (float) ($store->allocation_percent ?? 0);
        }

        return 100 / $selling->count();
    }
}
