<?php

namespace App\Jobs;

use App\Models\PlatformProduct;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\SyncLog;
use App\Services\Integrations\IntegrationFactory;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PushInventoryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $variant;

    protected $sourceStore;

    /**
     * Create a new job instance.
     */
    public function __construct(ProductVariant $variant, ?Store $sourceStore = null)
    {
        $this->variant = $variant;
        $this->sourceStore = $sourceStore;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $this->variant->refresh();
        $organization = $this->variant->product->organization;
        $stores = $organization->stores()
            ->where('status', 'connected')
            ->when($this->sourceStore, function ($query) {
                return $query->where('id', '!=', $this->sourceStore->id);
            })
            ->get();

        foreach ($stores as $store) {
            // A disabled mapping must never be bypassed by a stock adjustment or receipt.
            if (PlatformProduct::where('store_id', $store->id)->where('product_variant_id', $this->variant->id)->where('sync_enabled', false)->exists()) {
                continue;
            }
            $log = SyncLog::create(['store_id' => $store->id, 'type' => 'inventory_push', 'status' => 'in_progress']);
            try {
                $service = $this->getService($store);
                // The master retains its authoritative quantity; buffering it would compound
                // deductions on every inbound sync. Only downstream channels get a cushion.
                $quantity = max(0, (int) $this->variant->stock - ($store->is_master ? 0 : (int) $store->safety_stock));
                if ($service->updateInventory($store, $this->variant->sku, $quantity) === false) {
                    throw new \RuntimeException('Inventory update was not accepted by the channel.');
                }
                $log->update(['status' => 'success']);
            } catch (\Exception $e) {
                $log->update(['status' => 'failed']);
                Log::error("PushInventoryJob failed for store {$store->id}: ".$e->getMessage());
            }
        }
    }

    protected function getService(Store $store)
    {
        return IntegrationFactory::make($store->platform);
    }
}
