<?php

namespace App\Http\Controllers;

use App\Models\PlatformProduct;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Http\Request;

class ListingQualityController extends Controller
{
    public function index(Request $r)
    {
        $org = (int) $r->header('X-Organization-Id');
        $r->validate(['store_id' => 'nullable|integer', 'search' => 'nullable|string|max:100']);
        $stores = Store::where('organization_id', $org)->when($r->integer('store_id'), fn ($q, $id) => $q->whereKey($id))->get(['id', 'name', 'platform']);
        $products = Product::where('organization_id', $org)->with(['variants.platformProducts' => fn ($q) => $q->whereIn('store_id', $stores->pluck('id'))])
            ->when($r->string('search')->toString(), fn ($q, $s) => $q->where(fn ($p) => $p->where('name', 'like', '%'.$s.'%')->orWhere('sku', 'like', '%'.$s.'%')))->orderBy('id')->paginate(25);
        $conflicts = PlatformProduct::whereIn('store_id', $stores->pluck('id'))->selectRaw('store_id, external_id')->groupBy('store_id', 'external_id')->havingRaw('COUNT(DISTINCT product_variant_id) > 1')->get()->map(fn ($m) => $m->store_id.':'.$m->external_id)->flip();

        return response()->json($products->through(function ($p) use ($stores, $conflicts) {
            $issues = [];
            foreach (['sku', 'name', 'description', 'image_url'] as $field) {
                if (blank($p->$field)) {
                    $issues[] = 'missing_'.$field;
                }
            }
            if ((float) $p->price <= 0) {
                $issues[] = 'nonpositive_price';
            }
            if ($p->variants->isEmpty()) {
                $issues[] = 'no_variants';
            }
            $channels = $stores->map(function ($s) use ($p, $conflicts) {
                $mapped = 0;
                $disabled = 0;
                $conflict = 0;
                foreach ($p->variants as $v) {
                    foreach ($v->platformProducts->where('store_id', $s->id) as $m) {
                        $mapped++;
                        if (! $m->sync_enabled) {
                            $disabled++;
                        } if (isset($conflicts[$s->id.':'.$m->external_id])) {
                            $conflict++;
                        }
                    }
                }

                return ['store' => $s->name, 'platform' => $s->platform, 'mapped' => $mapped, 'variants' => $p->variants->count(), 'disabled' => $disabled, 'conflicts' => $conflict];
            });

            return ['id' => $p->id, 'name' => $p->name, 'sku' => $p->sku, 'issues' => $issues, 'channels' => $channels];
        }));
    }
}
