<?php

namespace App\Http\Controllers;

use App\Jobs\PushInventoryJob;
use App\Jobs\PushPricesJob;
use App\Models\Organization;
use App\Models\PlatformProduct;
use App\Models\PriceList;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use App\Services\Integrations\NoonService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * How one store is wired: the country it sells in, the channel warehouse it stocks, the
 * warehouses whose stock it sells and the price list it sells from. Also the codes a channel
 * knows our products by, and stock per warehouse.
 */
class ChannelSetupController extends Controller
{
    /** Countries a store can be set to sell in. Channels that span countries need one chosen. */
    public const MARKETS = ['sa', 'ae', 'kw', 'qa', 'bh', 'om', 'eg', 'jo', 'iq', 'ma', 'tr', 'de', 'gb', 'us'];

    public function show(Request $request, int $id)
    {
        $store = $this->store($request, $id);

        $channelWarehouses = [];
        $channelError = null;
        if ($store->platform === 'noon' && $store->integration) {
            try {
                $channelWarehouses = app(NoonService::class)->warehouses($store->integration);
            } catch (\Throwable $e) {
                $channelError = $e->getMessage();
            }
        }

        return response()->json([
            'market' => $store->market,
            'channel_warehouse' => $store->channel_warehouse,
            'warehouse_ids' => $store->warehouses()->pluck('warehouses.id'),
            'price_list_id' => $store->price_list_id,
            'options' => [
                'markets' => self::MARKETS,
                'channel_warehouses' => $channelWarehouses,
                'channel_warehouses_error' => $channelError,
                'warehouses' => Warehouse::where('organization_id', $store->organization_id)->where('is_active', true)
                    ->orderBy('name')->get(['id', 'name', 'code']),
                'price_lists' => PriceList::where('organization_id', $store->organization_id)->orderBy('name')->get(['id', 'name', 'currency']),
            ],
        ]);
    }

    public function update(Request $request, int $id)
    {
        $org = $this->managedOrganization($request);
        $store = $this->store($request, $id);
        $data = $request->validate([
            'market' => ['nullable', Rule::in(self::MARKETS)],
            'channel_warehouse' => 'nullable|string|max:64',
            'warehouse_ids' => 'array',
            'warehouse_ids.*' => ['integer', Rule::exists('warehouses', 'id')->where('organization_id', $org->id)],
            'price_list_id' => ['nullable', Rule::exists('price_lists', 'id')->where('organization_id', $org->id)],
        ]);

        $priceListChanged = array_key_exists('price_list_id', $data) && (int) $data['price_list_id'] !== (int) $store->price_list_id;
        $store->update(collect($data)->only(['market', 'channel_warehouse', 'price_list_id'])->all());
        if (array_key_exists('warehouse_ids', $data)) {
            $store->warehouses()->sync($data['warehouse_ids']);
        }

        // The numbers this store is offered may have changed: send them again.
        if (! $store->is_master && $store->status === 'connected') {
            ProductVariant::where('organization_id', $org->id)
                ->chunkById(200, fn ($variants) => $variants->each(fn ($variant) => PushInventoryJob::dispatch($variant)));
        }
        if ($priceListChanged && $store->price_list_id) {
            PushPricesJob::dispatch($store);
        }

        return $this->show($request, $id);
    }

    /** Variants with the code each sales channel knows them by. */
    public function skuLinks(Request $request)
    {
        $organizationId = (int) $request->header('X-Organization-Id');
        $search = trim((string) $request->query('search', ''));

        $variants = ProductVariant::where('organization_id', $organizationId)
            ->when($search !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('sku', 'like', "%{$search}%")
                ->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$search}%"))
                ->orWhereIn('id', PlatformProduct::where('external_sku', 'like', "%{$search}%")->select('product_variant_id'))))
            ->with('product:id,name')
            ->orderBy('sku')
            ->paginate(50);

        $links = PlatformProduct::whereIn('product_variant_id', $variants->pluck('id'))
            ->whereNotNull('external_sku')->get()->groupBy('product_variant_id');

        return response()->json([
            'stores' => $this->channels($organizationId)->map(fn (Store $s) => ['id' => $s->id, 'name' => $s->name, 'platform' => $s->platform])->values(),
            'data' => $variants->getCollection()->map(fn (ProductVariant $v) => [
                'id' => $v->id,
                'sku' => $v->sku,
                'name' => $v->product?->name,
                'codes' => ($links[$v->id] ?? collect())->pluck('external_sku', 'store_id'),
            ]),
            'total' => $variants->total(),
            'page' => $variants->currentPage(),
            'last_page' => $variants->lastPage(),
        ]);
    }

    /** Set, change or clear (empty code) the code one store uses for one variant. */
    public function setSkuLink(Request $request)
    {
        $org = $this->managedOrganization($request);
        $data = $request->validate([
            'variant_id' => ['required', Rule::exists('product_variants', 'id')->where('organization_id', $org->id)],
            'store_id' => ['required', Rule::exists('stores', 'id')->where('organization_id', $org->id)],
            'code' => 'nullable|string|max:191',
        ]);

        $this->link((int) $data['store_id'], (int) $data['variant_id'], $data['code'] ?? null);
        $variant = ProductVariant::find($data['variant_id']);
        PushInventoryJob::dispatch($variant);

        return response()->json(['message' => 'Saved.']);
    }

    /**
     * A CSV (it opens in Excel) with the columns: sku, store, code. `store` is the store's name
     * in Hubby. Rows that name an unknown SKU or store are skipped and reported.
     */
    public function importSkuLinks(Request $request)
    {
        $org = $this->managedOrganization($request);
        $rows = $this->csv($request);
        $stores = $this->channels($org->id)->keyBy(fn (Store $s) => mb_strtolower(trim($s->name)));

        $saved = 0;
        $skipped = [];
        foreach ($rows as $line => $row) {
            $sku = trim((string) ($row['sku'] ?? ''));
            $store = $stores[mb_strtolower(trim((string) ($row['store'] ?? '')))] ?? null;
            $variant = $sku === '' ? null : ProductVariant::where('organization_id', $org->id)->where('sku', $sku)->first();
            if (! $store || ! $variant) {
                $skipped[] = $line + 2;

                continue;
            }
            $this->link($store->id, $variant->id, $row['code'] ?? null);
            $saved++;
        }

        return response()->json(['saved' => $saved, 'skipped_lines' => array_slice($skipped, 0, 50), 'skipped' => count($skipped)]);
    }

    /** Units of one variant in each warehouse. */
    public function warehouseStock(Request $request)
    {
        $organizationId = (int) $request->header('X-Organization-Id');
        $data = $request->validate(['variant_id' => 'required|integer']);

        return response()->json([
            'warehouses' => Warehouse::where('organization_id', $organizationId)->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
            'quantities' => WarehouseStock::where('organization_id', $organizationId)
                ->where('product_variant_id', $data['variant_id'])->pluck('quantity', 'warehouse_id'),
        ]);
    }

    /** Type the units of a variant in a warehouse. The variant's total becomes the sum of its warehouses. */
    public function setWarehouseStock(Request $request)
    {
        $org = $this->managedOrganization($request);
        $data = $request->validate([
            'variant_id' => ['required', Rule::exists('product_variants', 'id')->where('organization_id', $org->id)],
            'warehouse_id' => ['required', Rule::exists('warehouses', 'id')->where('organization_id', $org->id)],
            'quantity' => 'required|integer|min:0|max:10000000',
        ]);

        $variant = DB::transaction(function () use ($org, $data) {
            WarehouseStock::updateOrCreate(
                ['warehouse_id' => $data['warehouse_id'], 'product_variant_id' => $data['variant_id']],
                ['organization_id' => $org->id, 'quantity' => $data['quantity']],
            );
            $variant = ProductVariant::findOrFail($data['variant_id']);
            $variant->update(['stock' => WarehouseStock::where('product_variant_id', $variant->id)->sum('quantity')]);

            return $variant;
        });
        PushInventoryJob::dispatch($variant);

        return response()->json(['stock' => $variant->stock]);
    }

    private function link(int $storeId, int $variantId, ?string $code): void
    {
        $code = trim((string) $code);
        $listing = PlatformProduct::firstOrNew(['store_id' => $storeId, 'product_variant_id' => $variantId]);
        if (! $listing->exists) {
            if ($code === '') {
                return;
            }
            $listing->external_id = '';
        }
        $listing->external_sku = $code === '' ? null : $code;
        $listing->save();
    }

    /** @return array<int, array<string, ?string>> the rows of an uploaded CSV, keyed by its header. */
    public static function csv(Request $request): array
    {
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:5120']]);
        $handle = fopen($request->file('file')->getRealPath(), 'r');
        abort_if($handle === false, 422, 'Could not read the file.');
        $header = fgetcsv($handle);
        abort_if($header === false || $header === null, 422, 'The file is empty.');
        // Excel saves CSV with a byte-order mark in front of the first header.
        $header = array_map(fn ($h) => strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $h))), $header);

        $rows = [];
        while (($cols = fgetcsv($handle)) !== false) {
            if ($cols === [null]) {
                continue;
            }
            $rows[] = array_combine($header, array_slice(array_pad($cols, count($header), null), 0, count($header)));
        }
        fclose($handle);

        return $rows;
    }

    private function channels(int $organizationId)
    {
        return Store::where('organization_id', $organizationId)->where('is_master', false)
            ->where('platform', '!=', 'odoo')->orderBy('id')->get();
    }

    private function store(Request $request, int $id): Store
    {
        return Store::where('organization_id', $request->header('X-Organization-Id'))->with('integration')->findOrFail($id);
    }

    private function managedOrganization(Request $request): Organization
    {
        $org = Organization::findOrFail($request->header('X-Organization-Id'));
        $role = $org->users()->where('users.id', $request->user()->id)->first()?->pivot->role;
        abort_unless(in_array($role, ['owner', 'admin'], true), 403);

        return $org;
    }
}
