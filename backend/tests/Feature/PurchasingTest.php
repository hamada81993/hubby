<?php

namespace Tests\Feature;

use App\Models\CostLayer;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class PurchasingTest extends TestCase
{
    use RefreshDatabase;

    public function test_partial_receipts_are_bounded_and_idempotent(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        $user->organizations()->attach($org->id, ['role' => 'owner']);
        $product = Product::create(['organization_id' => $org->id, 'name' => 'Bag', 'sku' => 'BAG', 'price' => 20]);
        $v = $product->variants()->create(['sku' => 'BAG-S', 'price' => 20, 'stock' => 2]);
        $this->actingAs($user)->withHeader('X-Organization-Id', $org->id);
        $supplier = $this->postJson('/api/suppliers', ['name' => 'Supplier', 'lead_days' => 10])->assertCreated()->json('id');
        $po = $this->postJson('/api/purchase-orders', ['supplier_id' => $supplier, 'reference' => 'PO1', 'lines' => [['variant_id' => $v->id, 'quantity' => 5, 'unit_cost' => 3]]])->assertCreated()->json('id');
        $request = ['request_id' => (string) Str::uuid(), 'lines' => [['variant_id' => $v->id, 'quantity' => 3]]];
        $this->postJson('/api/purchase-orders/'.$po.'/receive', $request)->assertConflict();
        $this->postJson('/api/purchase-orders/'.$po.'/submit')->assertOk();
        $this->postJson('/api/purchase-orders/'.$po.'/receive', $request)->assertOk()->assertJsonPath('status', 'partial');
        $this->postJson('/api/purchase-orders/'.$po.'/receive', $request)->assertOk()->assertJsonPath('duplicate', true);
        $this->assertEquals(5, $v->fresh()->stock);
        $this->assertEquals(1, CostLayer::count());
        $request['request_id'] = (string) Str::uuid();
        $this->postJson('/api/purchase-orders/'.$po.'/receive', $request)->assertUnprocessable();
        $this->assertEquals(5, $v->fresh()->stock);
        $request['lines'][0]['quantity'] = 2;
        $this->postJson('/api/purchase-orders/'.$po.'/receive', $request)->assertOk()->assertJsonPath('status', 'received');
        $this->assertEquals(7, $v->fresh()->stock);
    }
}
