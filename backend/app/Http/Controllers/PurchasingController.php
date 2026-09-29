<?php

namespace App\Http\Controllers;

use App\Jobs\PushInventoryJob;
use App\Models\CostLayer;
use App\Models\InventoryLog;
use App\Models\OrderItem;
use App\Models\Organization;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PurchasingController extends Controller
{
    private function org(Request $r, bool $write = false): int
    {
        $org = Organization::findOrFail($r->header('X-Organization-Id'));
        if ($write) {
            abort_unless(in_array($org->users()->where('users.id', $r->user()->id)->first()?->pivot->role, ['owner', 'admin']), 403);
        }

        return $org->id;
    }

    public function suppliers(Request $r)
    {
        return response()->json(DB::table('suppliers')->where('organization_id', $this->org($r))->orderBy('name')->get());
    }

    public function supplier(Request $r)
    {
        $org = $this->org($r, true);
        $d = $r->validate(['name' => 'required|string|max:255', 'email' => 'nullable|email|max:255', 'lead_days' => 'required|integer|min:0|max:365']);
        $id = DB::table('suppliers')->insertGetId($d + ['organization_id' => $org, 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['id' => $id] + $d, 201);
    }

    public function index(Request $r)
    {
        return response()->json(DB::table('purchase_orders')->where('organization_id', $this->org($r))->latest('id')->paginate(20)->through(function ($p) {
            $p->lines = json_decode($p->lines);

            return $p;
        }));
    }

    public function store(Request $r)
    {
        $org = $this->org($r, true);
        $d = $r->validate(['supplier_id' => ['required', 'integer', Rule::exists('suppliers', 'id')->where('organization_id', $org)], 'reference' => 'required|string|max:100', 'expected_at' => 'nullable|date', 'lines' => 'required|array|min:1|max:100', 'lines.*.variant_id' => ['required', 'integer', 'distinct', Rule::exists('product_variants', 'id')->where('organization_id', $org)], 'lines.*.quantity' => 'required|integer|min:1|max:1000000', 'lines.*.unit_cost' => 'required|numeric|min:0|max:1000000']);
        abort_if(DB::table('purchase_orders')->where('organization_id', $org)->where('reference', $d['reference'])->exists(), 409, 'Reference already exists.');
        $variants = ProductVariant::where('organization_id', $org)->whereIn('id', array_column($d['lines'], 'variant_id'))->get()->keyBy('id');
        $lines = array_map(fn ($l) => ['variant_id' => (int) $l['variant_id'], 'quantity' => (int) $l['quantity'], 'unit_cost' => (string) $l['unit_cost'], 'sku' => $variants[$l['variant_id']]->sku, 'received' => 0], $d['lines']);
        $id = DB::table('purchase_orders')->insertGetId(['organization_id' => $org, 'supplier_id' => $d['supplier_id'], 'reference' => $d['reference'], 'expected_at' => $d['expected_at'] ?? null, 'currency' => Organization::find($org)->base_currency ?? 'SAR', 'lines' => json_encode($lines), 'status' => 'draft', 'created_by' => $r->user()->id, 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['id' => $id, 'lines' => $lines], 201);
    }

    public function submit(Request $r, int $id)
    {
        $org = $this->org($r, true);
        $changed = DB::table('purchase_orders')->where('organization_id', $org)->where('id', $id)->where('status', 'draft')->update(['status' => 'ordered', 'updated_at' => now()]);
        abort_unless($changed, 409, 'Only draft purchase orders can be marked ordered.');

        return response()->json(['status' => 'ordered']);
    }

    public function receive(Request $r, int $id)
    {
        $org = $this->org($r, true);
        $d = $r->validate(['request_id' => 'required|uuid', 'lines' => 'required|array|min:1|max:100', 'lines.*.variant_id' => 'required|integer|distinct', 'lines.*.quantity' => 'required|integer|min:1|max:1000000']);

        return DB::transaction(function () use ($org, $id, $d, $r) {
            $po = DB::table('purchase_orders')->where('organization_id', $org)->where('id', $id)->lockForUpdate()->first();
            abort_unless($po, 404);
            if (DB::table('purchase_receipts')->where('purchase_order_id', $id)->where('request_id', $d['request_id'])->exists()) {
                return response()->json(['duplicate' => true]);
            }
            abort_unless(in_array($po->status, ['ordered', 'partial']), 409, 'Only open ordered purchases can receive stock.');
            abort_unless($po->currency === (Organization::find($org)->base_currency ?? 'SAR'), 409, 'Base currency changed after this purchase was created. Resolve currency before receiving.');
            $lines = collect(json_decode($po->lines, true))->keyBy('variant_id');
            foreach (collect($d['lines'])->sortBy('variant_id') as $line) {
                $entry = $lines->get($line['variant_id']);
                abort_unless($entry && $line['quantity'] <= $entry['quantity'] - $entry['received'], 422, 'Quantity exceeds the unreceived balance.');
                $variant = ProductVariant::where('organization_id', $org)->whereKey($line['variant_id'])->lockForUpdate()->firstOrFail();
                $variant->increment('stock', $line['quantity']);
                InventoryLog::create(['product_id' => $variant->product_id, 'product_variant_id' => $variant->id, 'change' => $line['quantity'], 'source' => 'Purchase receipt', 'reason' => 'PO '.$po->reference]);
                CostLayer::create(['organization_id' => $org, 'product_variant_id' => $variant->id, 'sku' => $variant->sku, 'source' => 'purchase_order', 'source_ref' => 'PO-'.$id.'-'.$d['request_id'], 'acquired_at' => now(), 'qty_received' => $line['quantity'], 'qty_remaining' => $line['quantity'], 'unit_cost' => $entry['unit_cost'], 'currency' => $po->currency, 'fx_rate_to_base' => 1, 'unit_cost_base' => $entry['unit_cost'], 'is_estimated' => false, 'created_by' => $r->user()->id]);
                $entry['received'] += $line['quantity'];
                $lines->put($variant->id, $entry);
                PushInventoryJob::dispatch($variant)->afterCommit();
            }
            $status = $lines->every(fn ($l) => $l['received'] === $l['quantity']) ? 'received' : 'partial';
            DB::table('purchase_orders')->where('id', $id)->update(['lines' => json_encode($lines->values()), 'status' => $status, 'updated_at' => now()]);
            DB::table('purchase_receipts')->insert(['purchase_order_id' => $id, 'request_id' => $d['request_id'], 'lines' => json_encode($d['lines']), 'created_at' => now(), 'updated_at' => now()]);

            return response()->json(['status' => $status, 'lines' => $lines->values()]);
        });
    }

    public function replenishment(Request $r)
    {
        $org = $this->org($r);
        $d = $r->validate(['lead_days' => 'nullable|integer|min:0|max:365', 'cover_days' => 'nullable|integer|min:1|max:365', 'search' => 'nullable|string|max:100']);
        $lead = $d['lead_days'] ?? 14;
        $cover = $d['cover_days'] ?? 30;
        $velocity = OrderItem::whereHas('order', fn ($q) => $q->whereHas('store', fn ($s) => $s->where('organization_id', $org))->whereNotIn('status', ['cancelled', 'refunded'])->whereRaw('COALESCE(placed_at, created_at) >= ?', [now()->subDays(30)]))
            ->selectRaw('sku, SUM(quantity) as sold')->groupBy('sku')->pluck('sold', 'sku');
        $incoming = [];
        foreach (DB::table('purchase_orders')->where('organization_id', $org)->whereIn('status', ['ordered', 'partial'])->get(['lines']) as $p) {
            foreach (json_decode($p->lines, true) as $l) {
                $incoming[$l['variant_id']] = ($incoming[$l['variant_id']] ?? 0) + $l['quantity'] - $l['received'];
            }
        }
        $variants = ProductVariant::where('organization_id', $org)->when($d['search'] ?? null, fn ($q, $s) => $q->where('sku', 'like', '%'.$s.'%'))->orderBy('stock')->paginate(30);

        return response()->json($variants->through(function ($v) use ($velocity, $incoming, $lead, $cover) {
            $daily = (float) ($velocity[$v->sku] ?? 0) / 30;
            $onOrder = $incoming[$v->id] ?? 0;

            return ['id' => $v->id, 'sku' => $v->sku, 'stock' => $v->stock, 'incoming' => $onOrder, 'daily_sales' => round($daily, 2), 'days_remaining' => $daily > 0 ? round(max(0, $v->stock) / $daily, 1) : null, 'suggested_quantity' => max(0, (int) ceil($daily * ($lead + $cover) - $v->stock - $onOrder))];
        }));
    }
}
