<?php

namespace Tests\Feature;

use App\Jobs\PushInventoryJob;
use App\Models\Organization;
use App\Models\PlatformProduct;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class StockAllocationTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $user;
    private ProductVariant $variant;
    private Store $master;
    private Store $amazon;
    private Store $noon;
    private Store $trendyol;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->org = $this->makeOrganization($this->user);
        $this->user->organizations()->attach($this->org->id, ['role' => 'owner']);
        $product = Product::create(['organization_id' => $this->org->id, 'name' => 'Oud', 'sku' => 'OUD', 'price' => 10]);
        $this->variant = $product->variants()->create(['sku' => 'OUD-50', 'price' => 10, 'stock' => 100]);
        $store = fn (string $name, string $platform, array $extra = []) => Store::create(
            ['organization_id' => $this->org->id, 'name' => $name, 'platform' => $platform, 'status' => 'connected'] + $extra
        );
        $this->master = $store('ERP', 'odoo', ['is_master' => true]);
        $this->amazon = $store('Amazon', 'amazon');
        $this->noon = $store('Noon', 'noon');
        $this->trendyol = $store('Trendyol', 'trendyol');
    }

    /** Run the push and return what each store was told, keyed by store id. */
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
                        $this->job->sent[$store->id] = $quantity;
                    }
                };
            }
        };
        $job->handle();

        return $job->sent;
    }

    public function test_shared_mode_offers_the_whole_stock_to_every_channel(): void
    {
        $sent = $this->push();

        $this->assertSame(100, $sent[$this->amazon->id]);
        $this->assertSame(100, $sent[$this->noon->id]);
        $this->assertSame(100, $sent[$this->trendyol->id]);
    }

    public function test_split_mode_never_offers_more_than_the_stock_in_total(): void
    {
        $this->org->update(['stock_allocation_mode' => 'split']);
        $this->amazon->update(['allocation_percent' => 50]);
        $this->noon->update(['allocation_percent' => 30]);
        $this->trendyol->update(['allocation_percent' => 20]);

        $sent = $this->push();

        $this->assertSame(100, $sent[$this->master->id]); // the source keeps the real number
        $this->assertSame([50, 30, 20], [$sent[$this->amazon->id], $sent[$this->noon->id], $sent[$this->trendyol->id]]);

        // Seven left: shares round down, so the channels together stay within the stock.
        $this->variant->update(['stock' => 7]);
        $sent = $this->push();
        $channels = $sent[$this->amazon->id] + $sent[$this->noon->id] + $sent[$this->trendyol->id];
        $this->assertSame([3, 2, 1], [$sent[$this->amazon->id], $sent[$this->noon->id], $sent[$this->trendyol->id]]);
        $this->assertLessThanOrEqual(7, $channels);
    }

    public function test_split_mode_divides_evenly_when_no_shares_are_set(): void
    {
        $this->org->update(['stock_allocation_mode' => 'split']);

        $sent = $this->push();

        $this->assertSame([33, 33, 33], [$sent[$this->amazon->id], $sent[$this->noon->id], $sent[$this->trendyol->id]]);
    }

    public function test_manual_mode_uses_the_chosen_quantity_and_falls_back_to_shared(): void
    {
        $this->org->update(['stock_allocation_mode' => 'manual']);
        PlatformProduct::create(['store_id' => $this->amazon->id, 'product_variant_id' => $this->variant->id, 'external_id' => 'A', 'allocated_quantity' => 250]);
        PlatformProduct::create(['store_id' => $this->noon->id, 'product_variant_id' => $this->variant->id, 'external_id' => 'N', 'allocated_quantity' => 4]);

        $sent = $this->push();

        $this->assertSame(100, $sent[$this->amazon->id]); // capped at the real stock unless overselling is allowed
        $this->assertSame(4, $sent[$this->noon->id]);
        $this->assertSame(100, $sent[$this->trendyol->id]); // nothing chosen
    }

    public function test_manual_mode_may_exceed_the_stock_only_when_overselling_is_allowed(): void
    {
        $this->org->update(['stock_allocation_mode' => 'manual', 'allow_oversell' => true]);
        PlatformProduct::create(['store_id' => $this->amazon->id, 'product_variant_id' => $this->variant->id, 'external_id' => 'A', 'allocated_quantity' => 250]);

        $this->assertSame(250, $this->push()[$this->amazon->id]);
    }

    public function test_split_by_units_gives_each_channel_its_number_until_the_stock_runs_out(): void
    {
        $this->org->update(['stock_allocation_mode' => 'split', 'stock_split_basis' => 'units']);
        $this->amazon->update(['allocation_units' => 40]);
        $this->noon->update(['allocation_units' => 25]);
        // Trendyol has no number, so it is offered nothing.

        $sent = $this->push();
        $this->assertSame([40, 25, 0], [$sent[$this->amazon->id], $sent[$this->noon->id], $sent[$this->trendyol->id]]);

        // Only 50 on the shelf: the first channel is served in full, the next takes what is left.
        $this->variant->update(['stock' => 50]);
        $sent = $this->push();
        $this->assertSame([40, 10, 0], [$sent[$this->amazon->id], $sent[$this->noon->id], $sent[$this->trendyol->id]]);
    }

    public function test_the_settings_endpoint_saves_mode_and_shares_and_rejects_more_than_100(): void
    {
        $this->actingAs($this->user)->withHeader('X-Organization-Id', $this->org->id);

        $this->getJson('/api/stock-allocation')->assertOk()->assertJsonPath('mode', 'shared')->assertJsonCount(3, 'channels');

        $this->putJson('/api/stock-allocation', [
            'mode' => 'split',
            'percents' => [$this->amazon->id => 70, $this->noon->id => 40],
        ])->assertStatus(422);
        $this->assertSame('shared', $this->org->fresh()->stock_allocation_mode);

        $this->putJson('/api/stock-allocation', [
            'mode' => 'split',
            'percents' => [$this->amazon->id => 60, $this->noon->id => 40, $this->master->id => 100],
        ])->assertOk()->assertJsonPath('mode', 'split');
        $this->assertSame(60, $this->amazon->fresh()->allocation_percent);
        $this->assertNull($this->master->fresh()->allocation_percent); // the source never takes a share

        $this->putJson('/api/stock-allocation', [
            'mode' => 'split', 'basis' => 'units', 'allow_oversell' => true,
            'units' => [$this->amazon->id => 15],
        ])->assertOk()->assertJsonPath('basis', 'units')->assertJsonPath('allow_oversell', true);
        $this->assertSame(15, $this->amazon->fresh()->allocation_units);
    }

    public function test_a_listing_quantity_can_only_be_set_inside_your_own_organisation(): void
    {
        Queue::fake();
        $listing = PlatformProduct::create(['store_id' => $this->amazon->id, 'product_variant_id' => $this->variant->id, 'external_id' => 'A']);
        $this->org->update(['stock_allocation_mode' => 'manual']);

        $this->actingAs($this->user)->withHeader('X-Organization-Id', $this->org->id)
            ->putJson("/api/platform-products/{$listing->id}/allocation", ['quantity' => 12])
            ->assertOk()->assertJsonPath('allocated_quantity', 12);
        Queue::assertPushed(PushInventoryJob::class);

        $stranger = User::factory()->create();
        $other = $this->makeOrganization($stranger, 'Other');
        $stranger->organizations()->attach($other->id, ['role' => 'owner']);
        $this->app['auth']->forgetGuards();
        $this->actingAs($stranger)->withHeader('X-Organization-Id', $other->id)
            ->putJson("/api/platform-products/{$listing->id}/allocation", ['quantity' => 999])
            ->assertNotFound();
        $this->assertSame(12, $listing->fresh()->allocated_quantity);
    }
}
