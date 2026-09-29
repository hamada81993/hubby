<?php

namespace Tests\Feature;

use App\Jobs\PushInventoryJob;
use App\Jobs\SyncProductsJob;
use App\Models\PlatformProduct;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChannelSafetyStockTest extends TestCase
{
    use RefreshDatabase;

    public function test_push_uses_current_stock_buffers_only_downstream_and_honors_disabled_mapping(): void
    {
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        $product = Product::create(['organization_id' => $org->id, 'name' => 'Bag', 'sku' => 'B', 'price' => 10]);
        $variant = $product->variants()->create(['sku' => 'B-S', 'price' => 10, 'stock' => 10]);
        $master = Store::create(['organization_id' => $org->id, 'name' => 'Master', 'platform' => 'shopify', 'status' => 'connected', 'is_master' => true, 'safety_stock' => 5]);
        $channel = Store::create(['organization_id' => $org->id, 'name' => 'Channel', 'platform' => 'salla', 'status' => 'connected', 'safety_stock' => 5]);
        $disabled = Store::create(['organization_id' => $org->id, 'name' => 'Disabled', 'platform' => 'zid', 'status' => 'connected']);
        PlatformProduct::create(['store_id' => $disabled->id, 'product_variant_id' => $variant->id, 'external_id' => 'X', 'sync_enabled' => false]);
        $job = new class($variant) extends PushInventoryJob
        {
            public array $sent = [];

            protected function getService(Store $store)
            {
                return new class($this)
                {
                    public function __construct(private $job) {}

                    public function updateInventory($store, $sku, $quantity)
                    {
                        $this->job->sent[$store->id] = $quantity;
                    }
                };
            }
        };
        $variant->newQuery()->whereKey($variant->id)->update(['stock' => 3]);
        $job->handle();
        $this->assertSame(3, $job->sent[$master->id]);
        $this->assertSame(0, $job->sent[$channel->id]);
        $this->assertArrayNotHasKey($disabled->id, $job->sent);
    }

    public function test_master_cannot_be_buffered_and_unknown_master_does_not_clear_existing_authority(): void
    {
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        $user->organizations()->attach($org->id, ['role' => 'owner']);
        $master = Store::create(['organization_id' => $org->id, 'name' => 'Master', 'platform' => 'shopify', 'is_master' => true]);
        $this->actingAs($user)->withHeader('X-Organization-Id', $org->id);
        $this->putJson('/api/stores/'.$master->id.'/safety-stock', ['safety_stock' => 2])->assertUnprocessable();
        $this->postJson('/api/stores/999999/set-master')->assertNotFound();
        $this->assertTrue($master->fresh()->is_master);
    }

    public function test_downstream_catalog_sync_cannot_reimport_buffered_stock_into_central_inventory(): void
    {
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        Store::create(['organization_id' => $org->id, 'name' => 'Master', 'platform' => 'shopify', 'is_master' => true]);
        $channel = Store::create(['organization_id' => $org->id, 'name' => 'Channel', 'platform' => 'salla', 'safety_stock' => 2]);
        $product = Product::create(['organization_id' => $org->id, 'name' => 'Bag', 'sku' => 'B', 'price' => 10, 'stock' => 8]);
        $variant = $product->variants()->create(['sku' => 'B-S', 'price' => 10, 'stock' => 8]);
        $job = new class($channel) extends SyncProductsJob
        {
            protected function getService()
            {
                return new class
                {
                    public function fetchProducts($store): array
                    {
                        return [[]];
                    }
                };
            }

            protected function mapProductData(array $data): array
            {
                return ['sku' => 'B', 'name' => 'Bag', 'price' => 10, 'stock' => 6, 'description' => '', 'image_url' => null,
                    'variants' => [['sku' => 'B-S', 'name' => 'Small', 'price' => 10, 'stock' => 6, 'external_id' => 'X']]];
            }
        };
        $job->handle();
        $this->assertSame(8, (int) $variant->fresh()->stock);
        $this->assertSame(8, (int) $product->fresh()->stock);
        $this->assertDatabaseHas('sync_logs', ['store_id' => $channel->id, 'type' => 'products', 'status' => 'success']);
    }
}
