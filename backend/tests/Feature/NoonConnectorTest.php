<?php

namespace Tests\Feature;

use App\Jobs\SyncOrdersJob;
use App\Jobs\SyncProductsJob;
use App\Models\Order;
use App\Models\Store;
use App\Models\User;
use App\Services\Integrations\NoonService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * noon connects with a service-account key file: a signed login, session cookies on every
 * call, stock by warehouse and partner SKU, and FBPI orders pulled on a schedule.
 */
class NoonConnectorTest extends TestCase
{
    use RefreshDatabase;

    private string $publicKey;

    private string $keyFile;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();

        $pair = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($pair, $private);
        $this->publicKey = openssl_pkey_get_details($pair)['key'];
        $this->keyFile = json_encode(['key_id' => 'KEY-1', 'private_key' => $private, 'project_code' => 'PRJ200075']);
    }

    private function fakeNoon(): void
    {
        Http::fake([
            '*/identity/public/v1/api/login' => Http::response([], 200, ['Set-Cookie' => 'session=abc123; Path=/; HttpOnly']),
            '*/identity/v1/whoami' => Http::response(['user_code' => 'U1', 'username' => 'hubby']),
            '*/warehouse-platform/v1/warehouses/list' => Http::response(['next_token' => '', 'warehouses' => [
                ['warehouse_code' => 'WH-RUH', 'display_name' => 'Riyadh', 'fulfillment_system_code' => 'fbpi', 'is_active' => true],
                ['warehouse_code' => 'WH-OLD', 'display_name' => 'Closed', 'fulfillment_system_code' => 'fbpi', 'is_active' => false],
            ]]),
            '*/fbpi/v1/fbpi-orders/list*' => Http::response(['next_token' => '', 'orders' => [[
                'fbpi_order_nr' => 'FBPI-1', 'mp_code' => 'noon', 'mp_order_nr' => 'NSA1', 'mp_country_code' => 'sa',
                'currency_code' => 'SAR', 'warehouse_code' => 'WH-RUH', 'order_created_at' => '2026-11-27T10:00:00Z',
                'items' => [
                    ['mp_item_nr' => 'I1', 'partner_sku' => 'OUD-50', 'mp_status' => 'MP_ITEM_STATUS_CONFIRMED', 'integration_status' => 'INTEGRATION_ITEM_STATUS_ACKNOWLEDGED', 'delivered_invoice_price' => 100.0],
                    ['mp_item_nr' => 'I2', 'partner_sku' => 'OUD-50', 'mp_status' => 'MP_ITEM_STATUS_CONFIRMED', 'integration_status' => 'INTEGRATION_ITEM_STATUS_ACKNOWLEDGED', 'delivered_invoice_price' => 100.0],
                    ['mp_item_nr' => 'I3', 'partner_sku' => 'DATES-1', 'mp_status' => 'MP_ITEM_STATUS_CANCELLED', 'integration_status' => 'INTEGRATION_ITEM_STATUS_UNSPECIFIED', 'delivered_invoice_price' => 25.0],
                ],
            ]]]),
            '*/stock/v1/stock-update' => Http::response(['items' => []]),
        ]);
    }

    private function store(): Store
    {
        $org = $this->makeOrganization(User::factory()->create());
        $store = Store::create(['organization_id' => $org->id, 'name' => 'noon', 'platform' => 'noon', 'status' => 'connected']);
        $store->integration()->create(['access_token' => $this->keyFile, 'shop_domain' => 'PRJ200075']);

        return $store->fresh('integration');
    }

    public function test_it_signs_in_with_the_key_file_and_carries_the_session_cookie(): void
    {
        $this->fakeNoon();
        $store = $this->store();

        $this->assertTrue((new NoonService)->updateInventory($store, 'OUD-50', 7));

        Http::assertSent(function ($request) {
            if (! str_ends_with($request->url(), '/identity/public/v1/api/login')) {
                return false;
            }
            [$header, $claims, $signature] = explode('.', $request['token']);
            $decode = fn ($part) => base64_decode(strtr($part, '-_', '+/'));

            return $request['default_project_code'] === 'PRJ200075'
                && json_decode($decode($claims), true)['sub'] === 'KEY-1'
                && openssl_verify("{$header}.{$claims}", $decode($signature), $this->publicKey, OPENSSL_ALGO_SHA256) === 1;
        });
        // Stock goes to the active warehouse only, as an absolute quantity, with the session cookie.
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/stock/v1/stock-update')
            && $request->hasHeader('Cookie', 'session=abc123')
            && $request['items'] === [['warehouse_code' => 'WH-RUH', 'partner_sku' => 'OUD-50', 'qty' => 7]]);
    }

    public function test_orders_are_pulled_and_mapped(): void
    {
        $this->fakeNoon();
        Queue::fake();
        $store = $this->store();

        (new SyncOrdersJob($store, null, null, true))->handle();

        $order = Order::where('store_id', $store->id)->where('external_id', 'FBPI-1')->firstOrFail();
        $this->assertSame('confirmed', $order->status);
        // The cancelled line is not part of the total.
        $this->assertEqualsWithDelta(200.0, (float) $order->total, 0.001);
        $this->assertSame('SAR', $order->currency);
        $this->assertSame(3, $order->items()->count());
    }

    public function test_connecting_needs_a_real_key_file_that_noon_accepts(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        $user->organizations()->attach($org->id, ['role' => 'owner']);
        $headers = ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken, 'X-Organization-Id' => $org->id];
        $form = ['name' => 'noon KSA', 'platform' => 'noon', 'domain' => 'PRJ200075'];

        $this->withHeaders($headers)->postJson('/api/stores/connect', $form + ['access_token' => 'not a key file'])
            ->assertStatus(422);

        // A key noon refuses leaves no half-connected store behind.
        Http::fake(['*' => Http::response(['message' => 'unauthorised'], 401)]);
        $this->withHeaders($headers)->postJson('/api/stores/connect', $form + ['access_token' => $this->keyFile])
            ->assertStatus(422);
        $this->assertSame(0, Store::where('platform', 'noon')->count());

        Http::swap(new \Illuminate\Http\Client\Factory);
        $this->fakeNoon();
        $this->withHeaders($headers)->postJson('/api/stores/connect', $form + ['access_token' => $this->keyFile])
            ->assertStatus(201);
        Queue::assertPushed(SyncProductsJob::class);
    }
}
