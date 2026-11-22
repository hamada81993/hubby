<?php

namespace Tests\Feature;

use App\Jobs\SyncProductsJob;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OdooProductSyncTest extends TestCase
{
    use RefreshDatabase;

    private function odooStore(string $domain): Store
    {
        $user = User::factory()->create();
        $organization = $this->makeOrganization($user);
        $store = Store::create([
            'organization_id' => $organization->id,
            'name' => 'My Odoo',
            'platform' => 'odoo',
            'domain' => $domain,
            'status' => 'syncing',
        ]);
        $store->integration()->create([
            'access_token' => 'odoo-api-key',
            'refresh_token' => 'owner@example.com',
            'shop_domain' => $domain,
        ]);

        return $store;
    }

    public function test_products_are_imported_over_the_classic_json_rpc_api(): void
    {
        Http::fake(function (Request $request) {
            if (str_contains($request->url(), '/json/2/')) {
                return Http::response('Not found', 404); // an Odoo older than 19
            }
            $params = $request['params'];
            if ($params['service'] === 'common') {
                return Http::response(['jsonrpc' => '2.0', 'result' => 7]);
            }
            [$db, $uid, $key, $model] = $params['args'];
            $this->assertSame(['acme', 7, 'odoo-api-key'], [$db, $uid, $key]);

            return Http::response(['jsonrpc' => '2.0', 'result' => $model === 'product.template'
                ? [
                    ['id' => 1, 'name' => 'Oud Al Layl', 'default_code' => 'OUD-50', 'barcode' => false, 'list_price' => 220.0, 'description_sale' => 'Evening oud'],
                    ['id' => 2, 'name' => 'Linen mist', 'default_code' => false, 'barcode' => false, 'list_price' => 31.0, 'description_sale' => false],
                ]
                : [
                    ['id' => 11, 'product_tmpl_id' => [1, 'Oud Al Layl'], 'display_name' => 'Oud Al Layl (50ml)', 'default_code' => 'OUD-50', 'barcode' => false, 'lst_price' => 220.0, 'qty_available' => 12.0],
                    ['id' => 21, 'product_tmpl_id' => [2, 'Linen mist'], 'display_name' => 'Linen mist', 'default_code' => false, 'barcode' => '6281000000017', 'lst_price' => 31.0, 'qty_available' => 3.0],
                ]]);
        });

        $store = $this->odooStore('erp.example.com?db=acme');
        (new SyncProductsJob($store))->handle();

        $this->assertSame('connected', $store->fresh()->status);
        $oud = Product::where('sku', 'OUD-50')->firstOrFail();
        $this->assertSame('Oud Al Layl', $oud->name);
        $this->assertEquals(220, $oud->price);
        $this->assertEquals(12, $oud->stock);
        // No internal reference on the template: the variant's barcode stands in.
        $this->assertDatabaseHas('products', ['sku' => '6281000000017', 'name' => 'Linen mist', 'description' => null]);
        $this->assertSame(2, ProductVariant::count());
        $this->assertDatabaseHas('platform_products', ['store_id' => $store->id, 'external_id' => '11']);
    }

    public function test_odoo_19_is_read_with_the_api_key_alone(): void
    {
        Http::fake(function (Request $request) {
            $this->assertSame('Bearer odoo-api-key', $request->header('Authorization')[0]);
            if (str_ends_with($request->url(), '/res.users/context_get')) {
                return Http::response(['lang' => 'en_US']);
            }

            return Http::response(str_contains($request->url(), 'product.template')
                ? [['id' => 5, 'name' => 'Amber candle', 'default_code' => 'AMB-220', 'barcode' => false, 'list_price' => 115.0, 'description_sale' => false]]
                : [['id' => 50, 'product_tmpl_id' => [5, 'Amber candle'], 'display_name' => 'Amber candle', 'default_code' => 'AMB-220', 'barcode' => false, 'lst_price' => 115.0, 'qty_available' => 17.0]]);
        });

        $store = $this->odooStore('acme.odoo.com');
        (new SyncProductsJob($store))->handle();

        $this->assertSame('connected', $store->fresh()->status);
        $this->assertDatabaseHas('products', ['sku' => 'AMB-220', 'stock' => 17]);
    }

    public function test_a_rejected_key_marks_the_store_as_failed_with_a_reason(): void
    {
        Http::fake(['*' => Http::response(['message' => 'Invalid apikey'], 401)]);

        $store = $this->odooStore('acme.odoo.com');
        (new SyncProductsJob($store))->handle();

        $this->assertSame('error', $store->fresh()->status);
        $this->assertDatabaseHas('sync_logs', ['store_id' => $store->id, 'status' => 'failed']);
        $this->assertSame(0, Product::count());
    }
}
