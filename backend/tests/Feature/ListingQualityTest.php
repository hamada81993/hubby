<?php

namespace Tests\Feature;

use App\Models\PlatformProduct;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ListingQualityTest extends TestCase
{
    use RefreshDatabase;

    public function test_quality_reports_mapping_conflicts_without_exposing_other_tenants(): void
    {
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        $other = $this->makeOrganization($user, 'Other');
        $user->organizations()->attach($org->id, ['role' => 'owner']);
        $store = Store::create(['organization_id' => $org->id, 'name' => 'Own shop', 'platform' => 'shopify']);
        Product::create(['organization_id' => $other->id, 'name' => 'Private product', 'sku' => 'PRIVATE', 'price' => 10]);
        $product = Product::create(['organization_id' => $org->id, 'name' => 'Tote', 'sku' => 'TOTE', 'price' => 0]);
        foreach (['RED', 'BLUE'] as $sku) {
            $variant = $product->variants()->create(['sku' => $sku, 'price' => 10, 'stock' => 2]);
            PlatformProduct::create(['product_variant_id' => $variant->id, 'store_id' => $store->id, 'external_id' => 'duplicate', 'sync_enabled' => $sku === 'RED']);
        }

        $response = $this->actingAs($user)->withHeader('X-Organization-Id', $org->id)
            ->getJson('/api/listing-quality')->assertOk()->assertJsonCount(1, 'data')
            ->assertDontSee('Private product')->assertJsonPath('data.0.channels.0.conflicts', 2)
            ->assertJsonPath('data.0.channels.0.disabled', 1);
        $this->assertContains('missing_description', $response->json('data.0.issues'));
        $this->assertContains('nonpositive_price', $response->json('data.0.issues'));
        $this->getJson('/api/listing-quality?search=absent')->assertJsonCount(0, 'data');
    }
}
