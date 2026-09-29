<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\ReturnRequest;
use App\Services\Returns\ReturnService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CustomerPortalController extends Controller
{
    public function issue(Request $r, int $id)
    {
        $order = Order::whereHas('store', fn ($q) => $q->where('organization_id', $r->header('X-Organization-Id')))->findOrFail($id);
        $token = Str::random(64);
        DB::transaction(function () use ($order, $token) {
            Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            DB::table('customer_portals')->where('order_id', $order->id)->update(['expires_at' => now()]);
            DB::table('customer_portals')->insert(['order_id' => $order->id, 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDays(30), 'created_at' => now(), 'updated_at' => now()]);
        });

        return response()->json(['path' => '/portal/'.$token, 'expires_at' => now()->addDays(30)->toIso8601String()]);
    }

    private function portal(string $token)
    {
        abort_unless(strlen($token) === 64, 404);
        $portal = DB::table('customer_portals')->where('token_hash', hash('sha256', $token))->where('expires_at', '>', now())->first();
        abort_unless($portal, 404, 'Link expired or unavailable.');

        return $portal;
    }

    private function eligible(Order $order): bool
    {
        $delivered = $order->shipments()->where('status', 'delivered')->max('delivered_at');

        return ! in_array($order->status, ['cancelled', 'refunded']) && $delivered && Carbon::parse($delivered)->gte(now()->subDays(30));
    }

    public function show(string $token)
    {
        $portal = $this->portal($token);
        $order = Order::with('store', 'items', 'shipments.trackingEvents')->findOrFail($portal->order_id);

        return response()->json(['store' => $order->store->name, 'reference' => $order->external_id, 'status' => $order->status, 'can_return' => $this->eligible($order), 'return_window_days' => 30,
            'items' => $order->items->map(fn ($i) => $i->only(['id', 'name', 'quantity'])),
            'shipments' => $order->shipments->map(fn ($s) => ['status' => $s->status, 'tracking_number' => $s->tracking_number, 'estimated_delivery_at' => $s->estimated_delivery_at, 'events' => $s->trackingEvents->sortByDesc('event_at')->take(20)->values()->map(fn ($e) => $e->only(['status', 'description_en', 'description_ar', 'event_at']))]),
            'requests' => ReturnRequest::where('order_id', $order->id)->get(['rma_number', 'status', 'type'])])->header('Cache-Control', 'no-store');
    }

    public function requestReturn(Request $r, string $token, ReturnService $service)
    {
        $portal = $this->portal($token);
        $d = $r->validate(['request_id' => 'required|uuid', 'type' => 'required|in:customer_return,exchange', 'reason' => 'required|string|max:500', 'lines' => 'required|array|min:1|max:100', 'lines.*.order_item_id' => 'required|integer|distinct', 'lines.*.quantity' => 'required|integer|min:1']);

        return DB::transaction(function () use ($portal, $d, $service) {
            $order = Order::whereKey($portal->order_id)->lockForUpdate()->firstOrFail();
            abort_unless(DB::table('customer_portals')->where('id', $portal->id)->where('expires_at', '>', now())->exists(), 404, 'Link expired or unavailable.');
            $existing = DB::table('portal_requests')->where('customer_portal_id', $portal->id)->where('request_id', $d['request_id'])->first();
            if ($existing) {
                $rma = ReturnRequest::findOrFail($existing->return_request_id);

                return response()->json($rma->only(['rma_number', 'status']));
            }
            abort_unless($this->eligible($order), 422, 'Returns require confirmed delivery within the last 30 days. Contact the store for assistance.');
            foreach ($d['lines'] as $line) {
                abort_unless($order->items()->whereKey($line['order_item_id'])->exists(), 422, 'Invalid order item.');
            }
            try {
                $rma = $service->create($order, $d['lines'], ['origin' => 'portal', 'type' => $d['type'], 'reason_note' => $d['reason']]);
            } catch (\RuntimeException $e) {
                abort(422, 'Requested quantity is not available to return.');
            }
            DB::table('portal_requests')->insert(['customer_portal_id' => $portal->id, 'request_id' => $d['request_id'], 'return_request_id' => $rma->id, 'created_at' => now(), 'updated_at' => now()]);

            return response()->json($rma->only(['rma_number', 'status']), 201);
        });
    }
}
