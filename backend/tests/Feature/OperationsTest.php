<?php

namespace Tests\Feature;

use App\Jobs\SyncInventoryJob;
use App\Jobs\SyncOrdersJob;
use App\Jobs\SyncProductsJob;
use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Models\SyncLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class OperationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_queues_and_search_never_include_another_organization(): void
    {
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        $other = $this->makeOrganization($user, 'Other');
        $user->organizations()->attach($org->id, ['role' => 'owner']);
        foreach ([$org, $other] as $tenant) {
            $store = Store::create(['organization_id' => $tenant->id, 'name' => 'Shop', 'platform' => 'shopify']);
            Order::create(['store_id' => $store->id, 'external_id' => 'TEST-'.$tenant->id, 'status' => 'pending', 'total' => 100, 'currency' => 'SAR']);
        }
        $this->actingAs($user)->withHeader('X-Organization-Id', $org->id)
            ->getJson('/api/operations/queues/fulfillment')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.label', 'TEST-'.$org->id);
        $this->getJson('/api/search?q=TEST')->assertOk()->assertJsonCount(1);
        $this->withHeader('X-Organization-Id', $other->id)->getJson('/api/operations')->assertForbidden();
    }

    public function test_health_hides_provider_secrets_and_sync_is_deduplicated(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        $user->organizations()->attach($org->id, ['role' => 'owner']);
        $store = Store::create(['organization_id' => $org->id, 'name' => 'Shop', 'platform' => 'shopify']);
        SyncLog::create(['store_id' => $store->id, 'type' => 'orders', 'status' => 'failed', 'message' => 'secret-access-token']);
        $this->actingAs($user)->withHeader('X-Organization-Id', $org->id)
            ->getJson('/api/operations/health')->assertOk()->assertDontSee('secret-access-token')->assertJsonPath('0.state', 'failed');
        $this->postJson('/api/stores/'.$store->id.'/sync')->assertOk();
        $this->postJson('/api/stores/'.$store->id.'/sync')->assertOk();
        Queue::assertPushed(SyncOrdersJob::class, 1);
        Queue::assertPushed(SyncProductsJob::class, 1);
        $this->getJson('/api/operations/health')->assertJsonPath('0.state', 'running');
    }

    public function test_inventory_sync_only_reads_authoritative_tenant(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        $other = $this->makeOrganization($user, 'Other');
        $foreign = Product::create(['organization_id' => $other->id, 'name' => 'Other', 'sku' => 'P', 'price' => 1]);
        $foreignVariant = $foreign->variants()->create(['sku' => 'SAME', 'price' => 1, 'stock' => 9]);
        $own = Product::create(['organization_id' => $org->id, 'name' => 'Own', 'sku' => 'P', 'price' => 1]);
        $variant = $own->variants()->create(['sku' => 'SAME', 'price' => 1, 'stock' => 4]);
        $store = Store::create(['organization_id' => $org->id, 'name' => 'Shop', 'platform' => 'shopify', 'is_master' => true]);
        $job = new class($store) extends SyncInventoryJob
        {
            protected function getService()
            {
                return new class
                {
                    public function fetchInventory($store)
                    {
                        return [['sku' => 'SAME', 'quantity' => 12]];
                    }
                };
            }
        };
        $job->handle();
        $this->assertEquals(12, $variant->fresh()->stock);
        $this->assertEquals(9, $foreignVariant->fresh()->stock);
        $store->update(['is_master' => false]);
        $variant->update(['stock' => 7]);
        $job->handle();
        $this->assertEquals(7, $variant->fresh()->stock);
    }
}
