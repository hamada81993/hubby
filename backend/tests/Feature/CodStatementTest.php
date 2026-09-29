<?php

namespace Tests\Feature;

use App\Models\CodTransaction;
use App\Models\Order;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class CodStatementTest extends TestCase
{
    use RefreshDatabase;

    public function test_preview_and_apply_only_exact_matches_and_are_idempotent(): void
    {
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        $user->organizations()->attach($org->id, ['role' => 'owner']);
        $store = Store::create(['organization_id' => $org->id, 'name' => 'Shop', 'platform' => 'shopify']);
        foreach (['A1', 'A2'] as $awb) {
            $order = Order::create(['store_id' => $store->id, 'external_id' => $awb, 'status' => 'completed', 'total' => 100, 'currency' => 'SAR']);
            CodTransaction::create(['organization_id' => $org->id, 'store_id' => $store->id, 'order_id' => $order->id, 'carrier_code' => 'manual', 'awb_number' => $awb, 'status' => 'collected', 'expected_amount' => 100, 'collected_amount' => 100, 'currency' => 'SAR']);
        }
        $this->actingAs($user)->withHeader('X-Organization-Id', $org->id);
        $response = $this->postJson('/api/cod/statements', ['carrier_code' => 'manual', 'reference' => 'R1', 'file' => UploadedFile::fake()->createWithContent('statement.csv', "awb,currency,amount\nA1,SAR,100\nA2,SAR,90\nUNKNOWN,SAR,10\n")]);
        $response->assertCreated()->assertJsonPath('rows.0.status', 'matched')->assertJsonPath('rows.1.status', 'discrepancy')->assertJsonPath('rows.2.status', 'unmatched');
        $this->assertEquals(2, CodTransaction::where('status', 'collected')->count());
        $id = $response->json('id');
        $this->postJson('/api/cod/statements/'.$id.'/apply')->assertOk()->assertJsonPath('rows.0.status', 'applied');
        $this->postJson('/api/cod/statements/'.$id.'/apply')->assertOk()->assertJsonPath('rows.0.status', 'applied');
        $this->assertEquals(1, CodTransaction::where('status', 'remitted')->count());
        $this->assertEquals(1, CodTransaction::where('status', 'collected')->count());
        $other = $this->makeOrganization($user, 'Other');
        $user->organizations()->attach($other->id, ['role' => 'owner']);
        $this->withHeader('X-Organization-Id', $other->id)->postJson('/api/cod/statements/'.$id.'/apply')->assertNotFound();
    }
}
