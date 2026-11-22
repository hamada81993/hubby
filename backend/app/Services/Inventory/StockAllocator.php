<?php

namespace App\Services\Inventory;

use App\Models\Organization;
use App\Models\PlatformProduct;
use App\Models\ProductVariant;
use App\Models\Store;
use Illuminate\Support\Collection;

/**
 * Decides how many units of a variant each sales channel is told it can sell.
 *
 *  - shared: every channel is offered the whole stock (less its safety stock). One sale
 *    lowers the number everywhere on the next push.
 *  - split:  the stock is divided between channels, by percentage or by a fixed number of
 *    units per channel, so the channels together never offer more than is on the shelf.
 *  - manual: the merchant sets a quantity per listing. It may exceed the real stock only
 *    when the organisation allows overselling; listings without one behave as in `shared`.
 *
 * The master store is the source of the number and always keeps the full quantity.
 */
class StockAllocator
{
    public const MODES = ['shared', 'split', 'manual'];

    public const BASES = ['percent', 'units'];

    /** Stores that are a product source rather than a place stock is sold. */
    public const SOURCES = ['odoo'];

    /**
     * @param  Collection<int, Store>  $channels  every connected store of the organisation
     */
    public function quantityFor(ProductVariant $variant, Store $store, Organization $organization, Collection $channels): int
    {
        $stock = max(0, (int) $variant->stock);
        if ($store->is_master) {
            return $stock;
        }
        $mode = $organization->stock_allocation_mode ?? 'shared';

        if ($mode === 'manual') {
            $chosen = PlatformProduct::where('store_id', $store->id)
                ->where('product_variant_id', $variant->id)
                ->value('allocated_quantity');
            if ($chosen !== null) {
                return $organization->allow_oversell ? (int) $chosen : min((int) $chosen, $stock);
            }
        }

        if ($mode === 'split') {
            return ($organization->stock_split_basis ?? 'percent') === 'units'
                ? $this->unitsFor($store, $channels, $stock)
                : (int) floor($stock * $this->shareOf($store, $channels) / 100);
        }

        return max(0, $stock - (int) $store->safety_stock);
    }

    /** A channel's share in percent: what the merchant set, or an even split when nothing is set. */
    public function shareOf(Store $store, Collection $channels): float
    {
        $selling = $this->selling($channels);
        if (! $selling->contains('id', $store->id)) {
            return 0;
        }
        if ($selling->contains(fn (Store $s) => $s->allocation_percent !== null)) {
            return (float) ($store->allocation_percent ?? 0);
        }

        return 100 / $selling->count();
    }

    /**
     * Fixed units per channel. Channels are served in the order they were connected, each
     * taking its number from what is left, so a short stock runs out on the last ones first.
     */
    private function unitsFor(Store $store, Collection $channels, int $stock): int
    {
        $left = $stock;
        foreach ($this->selling($channels)->sortBy('id') as $channel) {
            $given = min((int) ($channel->allocation_units ?? 0), $left);
            if ($channel->id === $store->id) {
                return $given;
            }
            $left -= $given;
        }

        return 0;
    }

    private function selling(Collection $channels): Collection
    {
        return $channels->filter(fn (Store $s) => ! $s->is_master && ! in_array($s->platform, self::SOURCES, true));
    }
}
