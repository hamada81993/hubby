<?php

namespace App\Http\Controllers;

use App\Models\CodTransaction;
use App\Models\Order;
use App\Models\Organization;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ReturnRequest;
use App\Models\Shipment;
use App\Models\Store;
use App\Models\SyncLog;
use Illuminate\Http\Request;

/** Live operational queues. Financial reports keep their separate cost.access gate. */
class OperationsController extends Controller
{
    private function queues(Request $request): array
    {
        $org = (int) $request->header('X-Organization-Id');
        $stores = Store::where('organization_id', $org)->when($request->integer('store_id'), fn ($q, $id) => $q->whereKey($id))->select('id');

        return [
            'fulfillment' => Order::whereIn('store_id', clone $stores)->whereIn('status', ['pending', 'processing', 'paid', 'authorized'])->where('is_held', false)
                ->where(fn ($q) => $q->whereNull('fulfillment_status')->orWhereNotIn('fulfillment_status', ['fulfilled', 'shipped', 'delivered'])),
            'held' => Order::whereIn('store_id', clone $stores)->where('is_held', true)->whereNotIn('status', ['cancelled', 'completed', 'refunded']),
            'delivery' => Shipment::where('organization_id', $org)->whereIn('store_id', clone $stores)->where(function ($q) {
                $q->whereIn('status', ['exception', 'delivery_attempted', 'failed_attempt', 'held', 'lost', 'damaged'])
                    ->orWhere(fn ($q) => $q->whereNotIn('status', Shipment::FINAL_STATUSES)->where('estimated_delivery_at', '<', now()));
            }),
            'cod' => CodTransaction::where('organization_id', $org)->whereIn('store_id', clone $stores)->where('status', 'collected')->where('due_at', '<', now()),
            'returns' => ReturnRequest::where('organization_id', $org)->whereIn('store_id', clone $stores)->whereIn('status', ['requested', 'received']),
            'stock' => ProductVariant::where('organization_id', $org)->where('stock', '<=', 5)
                ->when($request->integer('store_id'), fn ($q, $id) => $q->whereHas('platformProducts', fn ($p) => $p->where('store_id', $id))),
        ];
    }

    public function summary(Request $request)
    {
        $request->validate(['store_id' => 'nullable|integer']);
        $queues = $this->queues($request);
        $org = Organization::findOrFail($request->header('X-Organization-Id'));
        $stores = Store::where('organization_id', $org->id)->get(['id', 'name', 'platform']);

        return response()->json([
            'generated_at' => now()->toIso8601String(),
            'base_currency' => $org->base_currency ?? 'SAR',
            'stores' => $stores,
            'queues' => collect($queues)->map(fn ($q, $key) => ['key' => $key, 'count' => $q->count()])->values(),
            'stock_threshold' => 5,
        ]);
    }

    public function queue(Request $request, string $kind)
    {
        $queues = $this->queues($request);
        abort_unless(isset($queues[$kind]), 404);
        $rows = $queues[$kind]->orderBy('id')->paginate(20);
        $rows->through(fn ($row) => [
            'id' => $row->id,
            'label' => match ($kind) {
                'stock' => $row->sku,
                'returns' => $row->rma_number,
                'delivery' => $row->tracking_number ?? $row->reference ?? (string) $row->id,
                'cod' => $row->awb_number ?? (string) $row->order_id,
                default => $row->external_id,
            },
            'status' => $kind === 'stock' ? (string) $row->stock : $row->status,
            'href' => match ($kind) {
                'stock' => '/products/'.$row->product_id,
                'returns' => '/returns/'.$row->id,
                'delivery' => '/shipments/'.$row->id,
                'cod' => '/orders/'.$row->order_id,
                default => '/orders/'.$row->id,
            },
        ]);

        return response()->json($rows);
    }

    public function health(Request $request)
    {
        $stores = Store::where('organization_id', $request->header('X-Organization-Id'))->with('integration:id,store_id,expires_at')->get();

        return response()->json($stores->map(function ($store) {
            // Only expose structured state; provider error strings can contain credentials.
            $logs = SyncLog::where('store_id', $store->id)->latest('id')->limit(15)->get(['id', 'type', 'status', 'created_at', 'updated_at']);
            $latest = SyncLog::whereIn('id', SyncLog::where('store_id', $store->id)->selectRaw('MAX(id)')->groupBy('type'))
                ->get(['id', 'type', 'status', 'updated_at']);
            $running = $latest->contains(fn ($log) => in_array($log->status, ['queued', 'in_progress']));
            $stalled = $latest->contains(fn ($log) => in_array($log->status, ['queued', 'in_progress']) && $log->updated_at->lt(now()->subMinutes(30)));
            $failed = $latest->contains('status', 'failed');

            return [
                'id' => $store->id, 'name' => $store->name, 'platform' => $store->platform,
                'last_synced_at' => $store->last_synced_at,
                'credential_expires_at' => $store->integration?->expires_at,
                'refund_push_supported' => in_array('refund', config('returns.capabilities.'.$store->platform, []), true),
                'state' => $stalled ? 'stalled' : ($running ? 'running' : ($failed ? 'failed' : ($logs->isEmpty() ? 'unknown' : 'healthy'))),
                'logs' => $logs,
            ];
        }));
    }

    public function search(Request $request)
    {
        $data = $request->validate(['q' => 'required|string|min:2|max:100']);
        $org = $request->header('X-Organization-Id');
        $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $data['q']).'%';
        $orders = Order::whereHas('store', fn ($q) => $q->where('organization_id', $org))
            ->where(fn ($q) => $q->where('external_id', 'like', $term)->orWhere('customer_name', 'like', $term)->orWhere('customer_email', 'like', $term))
            ->latest('id')->limit(8)->get()->map(fn ($o) => ['type' => 'order', 'label' => $o->external_id.' · '.$o->customer_name, 'href' => '/orders/'.$o->id]);
        $products = Product::where('organization_id', $org)
            ->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('sku', 'like', $term)->orWhereHas('variants', fn ($v) => $v->where('sku', 'like', $term)))
            ->limit(8)->get()->map(fn ($p) => ['type' => 'product', 'label' => $p->name.' · '.$p->sku, 'href' => '/products/'.$p->id]);
        $shipments = Shipment::where('organization_id', $org)->where('tracking_number', 'like', $term)->limit(8)->get()
            ->map(fn ($s) => ['type' => 'shipment', 'label' => $s->tracking_number, 'href' => '/shipments/'.$s->id]);

        return response()->json($orders->concat($products)->concat($shipments)->values());
    }
}
