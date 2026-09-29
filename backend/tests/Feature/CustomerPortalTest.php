<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Shipment;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CustomerPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_token_is_revocable_and_return_requests_are_idempotent(): void
    {
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        $user->organizations()->attach($org->id, ['role' => 'owner']);
        $store = Store::create(['organization_id' => $org->id, 'name' => 'Shop', 'platform' => 'shopify']);
        $order = Order::create(['store_id' => $store->id, 'external_id' => 'O1', 'status' => 'completed', 'total' => 100, 'currency' => 'SAR', 'customer_email' => 'private@example.com']);
        $item = $order->items()->create(['external_id' => 'I1', 'sku' => 'S1', 'name' => 'Bag', 'quantity' => 2, 'price' => 50]);
        Shipment::create(['organization_id' => $org->id, 'store_id' => $store->id, 'order_id' => $order->id, 'reference' => 'S1', 'carrier_code' => 'manual', 'status' => 'delivered', 'delivered_at' => now()->subDay()]);
        $this->actingAs($user)->withHeader('X-Organization-Id', $org->id);
        $path = $this->postJson('/api/orders/'.$order->id.'/portal')->assertOk()->json('path');
        $token = basename($path);
        $this->getJson('/api/customer-portal/'.$token)->assertOk()->assertJsonPath('can_return', true)->assertDontSee('private@example.com');
        $payload = ['request_id' => (string) Str::uuid(), 'type' => 'exchange', 'reason' => 'Different size', 'lines' => [['order_item_id' => $item->id, 'quantity' => 1]]];
        $first = $this->postJson('/api/customer-portal/'.$token.'/returns', $payload)->assertCreated()->json('rma_number');
        $this->postJson('/api/customer-portal/'.$token.'/returns', $payload)->assertOk()->assertJsonPath('rma_number', $first);
        $this->assertDatabaseCount('return_requests', 1);
        $this->postJson('/api/orders/'.$order->id.'/portal')->assertOk();
        $this->getJson('/api/customer-portal/'.$token)->assertNotFound();
    }
}
