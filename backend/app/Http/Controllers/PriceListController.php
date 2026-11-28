<?php

namespace App\Http\Controllers;

use App\Jobs\PushPricesJob;
use App\Models\Organization;
use App\Models\PriceList;
use App\Models\PriceListItem;
use App\Models\ProductVariant;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Price lists: a store that sells from one uses its prices; products it does not mention
 * keep their own price. Lists read from Odoo are refreshed by the product sync and are not
 * edited here.
 */
class PriceListController extends Controller
{
    public function index(Request $request)
    {
        $organizationId = (int) $request->header('X-Organization-Id');

        return response()->json(
            PriceList::where('organization_id', $organizationId)->withCount('items')->orderBy('name')->get()
                ->map(fn (PriceList $list) => [
                    'id' => $list->id,
                    'name' => $list->name,
                    'currency' => $list->currency,
                    'items_count' => $list->items_count,
                    'from_odoo' => $list->source_store_id !== null,
                    'stores' => Store::where('price_list_id', $list->id)->pluck('name'),
                ]),
        );
    }

    public function store(Request $request)
    {
        $org = $this->managedOrganization($request);
        $data = $request->validate(['name' => 'required|string|max:120', 'currency' => 'nullable|string|size:3']);

        return response()->json(PriceList::create($data + ['organization_id' => $org->id]), 201);
    }

    public function destroy(Request $request, int $id)
    {
        $this->managedOrganization($request);
        $this->find($request, $id)->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    /** Variants with their own price and the price this list gives them, if any. */
    public function items(Request $request, int $id)
    {
        $list = $this->find($request, $id);
        $search = trim((string) $request->query('search', ''));

        $variants = ProductVariant::where('organization_id', $list->organization_id)
            ->when($search !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('sku', 'like', "%{$search}%")
                ->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$search}%"))))
            ->with('product:id,name')->orderBy('sku')->paginate(50);
        $prices = PriceListItem::where('price_list_id', $list->id)
            ->whereIn('product_variant_id', $variants->pluck('id'))->pluck('price', 'product_variant_id');

        return response()->json([
            'list' => ['id' => $list->id, 'name' => $list->name, 'currency' => $list->currency, 'from_odoo' => $list->source_store_id !== null],
            'data' => $variants->getCollection()->map(fn (ProductVariant $v) => [
                'id' => $v->id,
                'sku' => $v->sku,
                'name' => $v->product?->name,
                'base_price' => (float) $v->price,
                'price' => isset($prices[$v->id]) ? (float) $prices[$v->id] : null,
            ]),
            'total' => $variants->total(),
            'page' => $variants->currentPage(),
            'last_page' => $variants->lastPage(),
        ]);
    }

    /** Set or clear (null price) one variant's price in a list. */
    public function setItem(Request $request, int $id)
    {
        $org = $this->managedOrganization($request);
        $list = $this->editable($request, $id);
        $data = $request->validate([
            'variant_id' => ['required', Rule::exists('product_variants', 'id')->where('organization_id', $org->id)],
            'price' => 'nullable|numeric|min:0|max:99999999',
        ]);

        if ($data['price'] === null) {
            PriceListItem::where('price_list_id', $list->id)->where('product_variant_id', $data['variant_id'])->delete();
        } else {
            PriceListItem::updateOrCreate(
                ['price_list_id' => $list->id, 'product_variant_id' => $data['variant_id']],
                ['price' => $data['price']],
            );
        }
        $this->push($list);

        return response()->json(['message' => 'Saved.']);
    }

    /** A CSV (it opens in Excel) with the columns: sku, price. */
    public function import(Request $request, int $id)
    {
        $org = $this->managedOrganization($request);
        $list = $this->editable($request, $id);

        $saved = 0;
        $skipped = [];
        foreach (ChannelSetupController::csv($request) as $line => $row) {
            $sku = trim((string) ($row['sku'] ?? ''));
            $price = str_replace(',', '', trim((string) ($row['price'] ?? '')));
            $variant = $sku === '' ? null : ProductVariant::where('organization_id', $org->id)->where('sku', $sku)->first();
            if (! $variant || ! is_numeric($price) || (float) $price < 0) {
                $skipped[] = $line + 2;

                continue;
            }
            PriceListItem::updateOrCreate(
                ['price_list_id' => $list->id, 'product_variant_id' => $variant->id],
                ['price' => (float) $price],
            );
            $saved++;
        }
        $this->push($list);

        return response()->json(['saved' => $saved, 'skipped_lines' => array_slice($skipped, 0, 50), 'skipped' => count($skipped)]);
    }

    private function push(PriceList $list): void
    {
        $list->stores()->get()->each(fn (Store $store) => PushPricesJob::dispatch($store));
    }

    private function find(Request $request, int $id): PriceList
    {
        return PriceList::where('organization_id', $request->header('X-Organization-Id'))->findOrFail($id);
    }

    private function editable(Request $request, int $id): PriceList
    {
        $list = $this->find($request, $id);
        abort_if($list->source_store_id !== null, 422, 'This price list comes from Odoo. Change it there and it will update here.');

        return $list;
    }

    private function managedOrganization(Request $request): Organization
    {
        $org = Organization::findOrFail($request->header('X-Organization-Id'));
        $role = $org->users()->where('users.id', $request->user()->id)->first()?->pivot->role;
        abort_unless(in_array($role, ['owner', 'admin'], true), 403);

        return $org;
    }
}
