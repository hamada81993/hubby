<?php

namespace App\Services\Catalogue;

use App\Jobs\PushInventoryJob;
use App\Jobs\PushPricesJob;
use App\Models\PlatformProduct;
use App\Models\PriceList;
use App\Models\PriceListItem;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use App\Services\Integrations\OdooService;
use Illuminate\Support\Facades\Log;

/**
 * Brings what Odoo knows beyond the product itself: stock per warehouse and price lists.
 * Both are optional in Odoo, so a refusal (no Inventory app, no access) is logged and skipped
 * without failing the product sync.
 */
class OdooExtrasSync
{
    public function __construct(private OdooService $odoo) {}

    /** Odoo product id → our variant id, for the products this store brought in. */
    private function variantIds(Store $store): array
    {
        return PlatformProduct::where('store_id', $store->id)->pluck('product_variant_id', 'external_id')->all();
    }

    public function warehouses(Store $store): void
    {
        try {
            $data = $this->odoo->fetchWarehouseStock($store);
        } catch (\Throwable $e) {
            Log::info("Odoo warehouses not read for store {$store->id}: ".$e->getMessage());

            return;
        }

        $ours = [];
        foreach ($data['warehouses'] as $remote) {
            $warehouse = Warehouse::where('organization_id', $store->organization_id)
                ->where('meta->odoo_store_id', $store->id)
                ->where('meta->odoo_id', $remote['id'])
                ->first();
            if (! $warehouse) {
                // Codes are unique per organisation; a clash with a hand-made warehouse gets a suffix.
                $code = strtoupper(substr($remote['code'], 0, 20));
                if (Warehouse::where('organization_id', $store->organization_id)->where('code', $code)->exists()) {
                    $code = substr($code, 0, 16).'-O'.$remote['id'];
                }
                $warehouse = Warehouse::create([
                    'organization_id' => $store->organization_id,
                    'name' => $remote['name'],
                    'code' => $code,
                    'meta' => ['odoo_store_id' => $store->id, 'odoo_id' => $remote['id']],
                ]);
            } elseif ($warehouse->name !== $remote['name']) {
                $warehouse->update(['name' => $remote['name']]);
            }
            $ours[$remote['id']] = $warehouse->id;
        }
        if ($ours === []) {
            return;
        }

        $variantIds = $this->variantIds($store);
        $seen = [];
        $changed = [];
        foreach ($data['levels'] as $level) {
            $warehouseId = $ours[$level['warehouse_id']] ?? null;
            $variantId = $variantIds[$level['product_id']] ?? null;
            if (! $warehouseId || ! $variantId) {
                continue;
            }
            $row = WarehouseStock::firstOrNew(['warehouse_id' => $warehouseId, 'product_variant_id' => $variantId]);
            if (! $row->exists || $row->quantity !== $level['quantity']) {
                $row->fill(['organization_id' => $store->organization_id, 'quantity' => $level['quantity']])->save();
                $changed[$variantId] = true;
            }
            $seen[] = $row->id;
        }

        // Anything Odoo no longer reports in these warehouses is empty now.
        WarehouseStock::whereIn('warehouse_id', array_values($ours))
            ->whereNotIn('id', $seen)->where('quantity', '!=', 0)
            ->get()->each(function (WarehouseStock $row) use (&$changed) {
                $row->update(['quantity' => 0]);
                $changed[$row->product_variant_id] = true;
            });

        // Stores fed by specific warehouses need the new number even when the total did not move.
        foreach (ProductVariant::whereIn('id', array_keys($changed))->get() as $variant) {
            PushInventoryJob::dispatch($variant, $store);
        }
    }

    public function priceLists(Store $store): void
    {
        try {
            $lists = $this->odoo->fetchPriceLists($store);
        } catch (\Throwable $e) {
            Log::info("Odoo price lists not read for store {$store->id}: ".$e->getMessage());

            return;
        }

        $variantIds = $this->variantIds($store);
        foreach ($lists as $remote) {
            $list = PriceList::updateOrCreate(
                ['organization_id' => $store->organization_id, 'source_store_id' => $store->id, 'external_id' => $remote['id']],
                ['name' => $remote['name'], 'currency' => $remote['currency'] ? substr($remote['currency'], 0, 3) : null],
            );

            $changed = false;
            $kept = [];
            foreach ($remote['prices'] as $productId => $price) {
                if (! isset($variantIds[$productId])) {
                    continue;
                }
                $item = PriceListItem::firstOrNew(['price_list_id' => $list->id, 'product_variant_id' => $variantIds[$productId]]);
                if (! $item->exists || abs($item->price - $price) > 0.004) {
                    $item->fill(['price' => $price])->save();
                    $changed = true;
                }
                $kept[] = $item->id;
            }
            $changed = PriceListItem::where('price_list_id', $list->id)->whereNotIn('id', $kept)->delete() > 0 || $changed;

            if ($changed) {
                $list->stores()->get()->each(fn (Store $selling) => PushPricesJob::dispatch($selling));
            }
        }
    }
}
