<?php

namespace Tests\Feature;

use App\Jobs\PushInventoryJob;
use App\Jobs\PushPricesJob;
use App\Models\Organization;
use App\Models\PlatformProduct;
use App\Models\PriceList;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use App\Services\Catalogue\ChannelCatalogue;
use App\Services\Catalogue\OdooExtrasSync;
use App\Services\Integrations\OdooService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/** Per-store setup: channel product codes, warehouses that feed a store, price lists. */
class ChannelSetupTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;

    private ProductVariant $variant;

    private Store $master;

    private Store $amazon;

    private Store $noon;

    private array $headers;

    protected function setUp(): void
    {
        parent::setUp();
        $user = User::factory()->create();
        $this->org = $this->makeOrganization($user);
        $user->organizations()->attach($this->org->id, ['role' => 'owner']);
        $this->headers = ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken, 'X-Organization-Id' => $this->org->id];

        $product = Product::create(['organization_id' => $this->org->id, 'name' => 'Oud', 'sku' => 'OUD', 'price' => 10]);
        $this->variant = $product->variants()->create(['sku' => 'OUD-50', 'price' => 10, 'stock' => 100]);
        $store = fn (string $name, string $platform, array $extra = []) => Store::create(
            ['organization_id' => $this->org->id, 'name' => $name, 'platform' => $platform, 'status' => 'connected'] + $extra
        );
        $this->master = $store('ERP', 'odoo', ['is_master' => true]);
        $this->amazon = $store('Amazon', 'amazon');
        $this->noon = $store('Noon', 'noon');
    }

    /** Run the stock push and return [sku, quantity] each store was sent, keyed by store id. */
    private function push(): array
    {
        $job = new class($this->variant) extends PushInventoryJob
        {
            public array $sent = [];

            protected function getService(Store $store)
            {
                return new class($this)
                {
                    public function __construct(private $job) {}

                    public function updateInventory($store, $sku, $quantity)
                    {
                        $this->job->sent[$store->id] = [$sku, $quantity];
                    }
                };
            }
        };
        $job->handle();

        return $job->sent;
    }

    public function test_a_store_is_sent_stock_under_its_own_product_code(): void
    {
        Queue::fake();
        $this->withHeaders($this->headers)->putJson('/api/sku-links', [
            'variant_id' => $this->variant->id, 'store_id' => $this->amazon->id, 'code' => 'AMZ-OUD-001',
        ])->assertOk();

        $sent = $this->push();

        $this->assertSame('AMZ-OUD-001', $sent[$this->amazon->id][0]);
        // A store without a link keeps our SKU.
        $this->assertSame('OUD-50', $sent[$this->noon->id][0]);
        // An order line that names the channel's code is read back as our SKU.
        $this->assertSame('OUD-50', app(ChannelCatalogue::class)->localSku($this->amazon, 'AMZ-OUD-001'));
        $this->assertSame('UNKNOWN', app(ChannelCatalogue::class)->localSku($this->amazon, 'UNKNOWN'));

        // Clearing the code goes back to our SKU.
        $this->withHeaders($this->headers)->putJson('/api/sku-links', [
            'variant_id' => $this->variant->id, 'store_id' => $this->amazon->id, 'code' => '',
        ])->assertOk();
        $this->assertSame('OUD-50', $this->push()[$this->amazon->id][0]);
    }

    public function test_product_codes_can_be_uploaded_as_a_sheet(): void
    {
        Queue::fake();
        $csv = "\xEF\xBB\xBFSKU,Store,Code\nOUD-50,Amazon,AMZ-1\nOUD-50,noon,N-1\nNOPE,Amazon,X\nOUD-50,Nowhere,Y\n";

        $this->withHeaders($this->headers)->post('/api/sku-links/import', [
            'file' => UploadedFile::fake()->createWithContent('codes.csv', $csv),
        ])->assertOk()->assertJson(['saved' => 2, 'skipped' => 2, 'skipped_lines' => [4, 5]]);

        $this->assertSame('AMZ-1', PlatformProduct::where('store_id', $this->amazon->id)->value('external_sku'));
        $this->withHeaders($this->headers)->getJson('/api/sku-links?search=N-1')
            ->assertOk()->assertJsonPath('data.0.codes.'.$this->noon->id, 'N-1');
    }

    public function test_a_store_sells_only_the_stock_of_its_warehouses(): void
    {
        Queue::fake();
        $riyadh = Warehouse::create(['organization_id' => $this->org->id, 'name' => 'Riyadh', 'code' => 'RUH']);
        $jeddah = Warehouse::create(['organization_id' => $this->org->id, 'name' => 'Jeddah', 'code' => 'JED']);
        foreach ([[$riyadh, 70], [$jeddah, 30]] as [$warehouse, $quantity]) {
            $this->withHeaders($this->headers)->putJson('/api/warehouse-stock', [
                'variant_id' => $this->variant->id, 'warehouse_id' => $warehouse->id, 'quantity' => $quantity,
            ])->assertOk();
        }
        $this->assertSame(100, (int) $this->variant->fresh()->stock);

        $this->withHeaders($this->headers)->putJson("/api/stores/{$this->noon->id}/setup", [
            'market' => 'ae', 'channel_warehouse' => 'WH-DXB', 'warehouse_ids' => [$jeddah->id],
        ])->assertOk()->assertJsonPath('market', 'ae')->assertJsonPath('warehouse_ids.0', $jeddah->id);

        $sent = $this->push();

        $this->assertSame(30, $sent[$this->noon->id][1]);
        // No warehouses chosen: the whole stock.
        $this->assertSame(100, $sent[$this->amazon->id][1]);
    }

    public function test_a_store_sells_from_its_price_list(): void
    {
        Queue::fake();
        $listId = $this->withHeaders($this->headers)->postJson('/api/price-lists', ['name' => 'Marketplaces', 'currency' => 'SAR'])
            ->assertCreated()->json('id');
        $this->withHeaders($this->headers)->post("/api/price-lists/{$listId}/import", [
            'file' => UploadedFile::fake()->createWithContent('prices.csv', "sku,price\nOUD-50,14.5\nNOPE,3\n"),
        ])->assertOk()->assertJson(['saved' => 1, 'skipped' => 1]);

        $this->withHeaders($this->headers)->putJson("/api/stores/{$this->noon->id}/setup", ['price_list_id' => $listId])->assertOk();
        Queue::assertPushed(PushPricesJob::class);

        $catalogue = app(ChannelCatalogue::class);
        $this->assertSame(14.5, $catalogue->priceFor($this->variant, $this->noon->fresh()));
        // A store with no price list keeps the product's own price.
        $this->assertSame(10.0, $catalogue->priceFor($this->variant, $this->amazon));
    }

    public function test_odoo_warehouses_and_price_lists_are_brought_in(): void
    {
        Queue::fake();
        PlatformProduct::create(['store_id' => $this->master->id, 'product_variant_id' => $this->variant->id, 'external_id' => '501']);
        $odoo = new class extends OdooService
        {
            public function fetchWarehouseStock(Store $store): array
            {
                return [
                    'warehouses' => [['id' => 1, 'name' => 'Riyadh', 'code' => 'RUH'], ['id' => 2, 'name' => 'Jeddah', 'code' => 'JED']],
                    'levels' => [
                        ['warehouse_id' => 1, 'product_id' => '501', 'quantity' => 60],
                        ['warehouse_id' => 2, 'product_id' => '501', 'quantity' => 40],
                        ['warehouse_id' => 2, 'product_id' => '999', 'quantity' => 5],
                    ],
                ];
            }

            public function fetchPriceLists(Store $store): array
            {
                return [['id' => '7', 'name' => 'Wholesale', 'currency' => 'SAR', 'skipped' => 0, 'prices' => ['501' => 8.0]]];
            }
        };

        $sync = new OdooExtrasSync($odoo);
        $sync->warehouses($this->master);
        $sync->priceLists($this->master);
        // A second run changes nothing and creates nothing twice.
        $sync->warehouses($this->master);
        $sync->priceLists($this->master);

        $this->assertSame(2, Warehouse::where('organization_id', $this->org->id)->count());
        $this->assertSame([40, 60], WarehouseStock::orderBy('quantity')->pluck('quantity')->all());
        $list = PriceList::where('organization_id', $this->org->id)->sole();
        $this->assertSame('Wholesale', $list->name);
        $this->assertSame(8.0, $list->items()->sole()->price);

        // Lists that come from Odoo are not edited in Hubby.
        $this->withHeaders($this->headers)->putJson("/api/price-lists/{$list->id}/items", [
            'variant_id' => $this->variant->id, 'price' => 9,
        ])->assertStatus(422);
    }
}
