<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Store;
use App\Models\SyncLog;
use App\Services\Integrations\IntegrationFactory;
use App\Services\Shipping\AddressExtractor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class SyncOrdersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public ?Store $store;

    /**
     * When set, only the order with this platform id is synced — the webhook
     * path, where re-pulling the store's whole order history would be wasteful.
     */
    public ?string $externalId;

    /**
     * Create a new job instance.
     *
     * With no store the job fans out to one instance per store (the scheduler
     * path). With a store and no external id it syncs that store's orders.
     */
    public function __construct(
        ?Store $store = null,
        ?string $externalId = null,
        public ?int $syncLogId = null,
        /**
         * The every-minute scheduled pull. It keeps no log row and sends no notification unless
         * something fails, and it leaves orders that have not changed alone.
         */
        public bool $scheduled = false,
    ) {
        $this->store = $store;
        $this->externalId = $externalId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        if (! $this->store) {
            // Odoo is a product source, not a sales channel: it has no orders to pull.
            Store::where('platform', '!=', 'odoo')
                ->each(fn ($store) => self::dispatch($store, null, null, $this->scheduled));

            return;
        }
        $log = match (true) {
            $this->syncLogId !== null => SyncLog::findOrFail($this->syncLogId),
            $this->scheduled => null,
            default => SyncLog::create([
                'store_id' => $this->store->id,
                'type' => 'orders',
                'status' => 'in_progress',
            ]),
        };
        $log?->update(['status' => 'in_progress']);

        try {
            $service = $this->getService();
            $orders = $service->fetchOrders($this->store, $this->fetchParams());
            $synced = 0;

            foreach ($orders as $orderData) {
                $mappedData = $this->mapOrderData($orderData);

                // Platforms we can't narrow server-side return the full page, so
                // filter down to the webhook's order here.
                if ($this->externalId !== null && ($mappedData['external_id'] ?? null) !== $this->externalId) {
                    continue;
                }

                $synced++;

                // Capture the prior status before the upsert, so we can fire order.status_changed.
                $previous = Order::where('store_id', $this->store->id)
                    ->where('external_id', $mappedData['external_id'])
                    ->first(['status', 'total']);
                $previousStatus = $previous?->status;

                // The scheduled pull sees the same recent orders every minute; only new or
                // changed ones are worth the profit and automation work below.
                if ($this->scheduled && $previous
                    && $previousStatus === $mappedData['status']
                    && (float) $previous->total === (float) $mappedData['total']) {
                    continue;
                }

                $order = Order::updateOrCreate(
                    [
                        'store_id' => $this->store->id,
                        'external_id' => $mappedData['external_id'],
                    ],
                    [
                        'status' => $mappedData['status'],
                        'total' => $mappedData['total'],
                        'currency' => $mappedData['currency'],
                        'customer_name' => $mappedData['customer_name'],
                        'customer_email' => $mappedData['customer_email'],
                        // The platform's order date, so analytics buckets by when the order was
                        // placed, not when we happened to sync it (defect #7).
                        'placed_at' => $this->parseDate($mappedData['placed_at'] ?? null),
                        'raw_data' => $orderData,
                    ]
                );

                // Sync items
                foreach ($mappedData['items'] as $itemData) {
                    if ($order->wasRecentlyCreated) {
                        $this->consumeManualAllocation($itemData);
                    }
                    OrderItem::updateOrCreate(
                        [
                            'order_id' => $order->id,
                            'external_id' => $itemData['external_id'] ?? null,
                        ],
                        [
                            'name' => $itemData['name'],
                            'sku' => $itemData['sku'] ?? null,
                            'quantity' => $itemData['quantity'],
                            'price' => $itemData['price'],
                        ]
                    );
                }

                // Capture the ship-to address (normalized + city-canonicalized) so shipping has a
                // carrier-ready destination. Best-effort — a platform with no address just skips.
                try {
                    app(AddressExtractor::class)
                        ->forOrder($order->load('store'), $this->store->platform, $orderData);
                } catch (\Throwable $e) {
                    Log::warning("Address capture failed for order {$order->id}: ".$e->getMessage());
                }

                // Refresh the P&L rollup for this order now that its lines are in place.
                CalculateOrderProfitJob::dispatch($order->id);

                // Fire automation rules. order.created on first ingest, order.updated on re-sync;
                // the engine's ledger keeps a re-synced order from re-applying a rule.
                RunAutomationJob::dispatch(
                    $order->id,
                    $order->wasRecentlyCreated ? 'order.created' : 'order.updated',
                    'sync',
                );

                // Additionally fire order.status_changed when the platform status actually moved.
                if (! $order->wasRecentlyCreated
                    && $previousStatus !== null
                    && $previousStatus !== $order->status) {
                    RunAutomationJob::dispatch($order->id, 'order.status_changed', 'sync', $previousStatus);
                }
            }

            $log?->update(['status' => 'success']);

            if ($this->scheduled) {
                return;
            }

            if ($this->externalId !== null) {
                // Webhook-driven single-order sync: no notification (these fire
                // per order and would drown the merchant's feed).
                if ($synced === 0) {
                    Log::warning("SyncOrdersJob: order {$this->externalId} not returned by {$this->store->platform} for store {$this->store->id}.");
                }

                return;
            }

            Notification::create([
                'organization_id' => $this->store->organization_id,
                'title' => 'Sync Complete',
                'message' => "Successfully synced orders for {$this->store->name} ({$this->store->platform}).",
                'type' => 'success',
            ]);
        } catch (\Exception $e) {
            Log::error("SyncOrdersJob failed for store {$this->store->id}: ".$e->getMessage());
            $log?->update(['status' => 'failed', 'message' => $e->getMessage()]);

            if ($this->scheduled) {
                // One failed row per attempt would repeat every minute; the log line is enough.
                return;
            }

            Notification::create([
                'organization_id' => $this->store->organization_id,
                'title' => 'Sync Failed',
                'message' => "Failed to sync orders for {$this->store->name}: ".$e->getMessage(),
                'type' => 'error',
            ]);
        }
    }

    protected function getService()
    {
        return IntegrationFactory::make($this->store->platform);
    }

    /**
     * Normalise a platform-supplied order date to a Carbon instance, or null if it is
     * missing/unparseable — the caller stores null and analytics falls back to created_at.
     */
    protected function parseDate($value): ?Carbon
    {
        if (blank($value)) {
            return null;
        }

        try {
            // Carbon::parse handles ISO strings and DateTimeInterface (e.g. the Trendyol Carbon) alike.
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Query params narrowing the fetch to a single order, where the platform
     * supports it. Others fall back to a normal fetch plus a local filter.
     *
     * @return array<string, mixed>
     */
    protected function fetchParams(): array
    {
        if ($this->externalId === null) {
            return [];
        }

        return match ($this->store->platform) {
            // status=any is required — Shopify's order list defaults to open only.
            'shopify' => ['ids' => $this->externalId, 'status' => 'any'],
            default => [],
        };
    }

    protected function mapOrderData(array $data): array
    {
        if ($this->store->platform === 'shopify') {
            return [
                'external_id' => (string) $data['id'],
                'status' => $data['financial_status'],
                'total' => $data['total_price'],
                'currency' => $data['currency'],
                'customer_name' => ($data['customer']['first_name'] ?? '').' '.($data['customer']['last_name'] ?? ''),
                'customer_email' => $data['customer']['email'] ?? null,
                'placed_at' => $data['created_at'] ?? $data['processed_at'] ?? null,
                'items' => array_map(fn ($item) => [
                    'external_id' => (string) $item['id'],
                    'name' => $item['title'],
                    'sku' => $item['sku'],
                    'quantity' => $item['quantity'],
                    'price' => $item['price'],
                ], $data['line_items']),
            ];
        }

        if ($this->store->platform === 'salla') {
            return [
                'external_id' => (string) $data['id'],
                'status' => $data['status']['name'] ?? 'pending',
                'total' => $data['amounts']['total']['amount'] ?? 0,
                'currency' => $data['amounts']['total']['currency'] ?? 'SAR',
                'customer_name' => ($data['customer']['first_name'] ?? '').' '.($data['customer']['last_name'] ?? ''),
                'customer_email' => $data['customer']['email'] ?? null,
                'placed_at' => $data['date']['date'] ?? $data['created_at'] ?? null,
                'items' => array_map(fn ($item) => [
                    'external_id' => (string) $item['id'],
                    'name' => $item['name'],
                    'sku' => $item['sku'],
                    'quantity' => $item['quantity'],
                    'price' => $item['price']['amount'] ?? 0,
                ], $data['items'] ?? []),
            ];
        }

        if ($this->store->platform === 'trendyol') {
            return [
                'external_id' => (string) ($data['orderNumber'] ?? $data['id']),
                'status' => strtolower($data['status'] ?? $data['shipmentPackageStatus'] ?? 'pending'),
                'total' => $data['totalPrice'] ?? $data['grossAmount'] ?? 0,
                'currency' => $data['currencyCode'] ?? 'SAR',
                'customer_name' => trim(($data['customerFirstName'] ?? '').' '.($data['customerLastName'] ?? '')),
                'customer_email' => $data['customerEmail'] ?? null,
                // Trendyol sends orderDate as epoch milliseconds.
                'placed_at' => isset($data['orderDate'])
                    ? Carbon::createFromTimestampMs((int) $data['orderDate'])
                    : null,
                'items' => array_map(fn ($item) => [
                    'external_id' => (string) ($item['id'] ?? $item['lineItemId'] ?? ''),
                    'name' => $item['productName'] ?? $item['name'] ?? '',
                    'sku' => $item['sku'] ?? $item['merchantSku'] ?? $item['barcode'] ?? null,
                    'quantity' => $item['quantity'] ?? 1,
                    'price' => $item['price'] ?? $item['amount'] ?? 0,
                ], $data['lines'] ?? $data['items'] ?? []),
            ];
        }

        if ($this->store->platform === 'noon') {
            // noon reports one line per unit, with a marketplace state and a fulfilment state each.
            $items = $data['items'] ?? [];
            $live = array_filter($items, fn ($item) => ($item['mp_status'] ?? '') !== 'MP_ITEM_STATUS_CANCELLED');
            $shipped = array_filter($live, fn ($item) => ($item['integration_status'] ?? '') === 'INTEGRATION_ITEM_STATUS_SHIPPED');

            return [
                'external_id' => (string) $data['fbpi_order_nr'],
                'status' => match (true) {
                    $items && ! $live => 'cancelled',
                    $live && count($shipped) === count($live) => 'shipped',
                    default => 'confirmed',
                },
                'total' => array_sum(array_map(fn ($item) => (float) ($item['delivered_invoice_price'] ?? 0), $live)),
                'currency' => $data['currency_code'] ?? 'SAR',
                // The buyer is only available from a separate customer-details call.
                'customer_name' => '',
                'customer_email' => null,
                'placed_at' => $data['order_created_at'] ?? null,
                'items' => array_map(fn ($item) => [
                    'external_id' => (string) ($item['mp_item_nr'] ?? ''),
                    'name' => $item['partner_sku'] ?? '',
                    'sku' => $item['partner_sku'] ?? null,
                    'quantity' => ($item['mp_status'] ?? '') === 'MP_ITEM_STATUS_CANCELLED' ? 0 : 1,
                    'price' => $item['delivered_invoice_price'] ?? 0,
                ], $items),
            ];
        }

        return $data;
    }

    /**
     * Manual stock allocation: the merchant set how many units this channel may sell, so a new
     * order there uses up that number. Without this the next stock push would offer the full
     * chosen quantity again and oversell.
     */
    protected function consumeManualAllocation(array $item): void
    {
        $sku = $item['sku'] ?? null;
        $quantity = (int) ($item['quantity'] ?? 0);
        if (! $sku || $quantity <= 0) {
            return;
        }

        $listing = \App\Models\PlatformProduct::where('store_id', $this->store->id)
            ->whereNotNull('allocated_quantity')
            ->whereHas('productVariant', fn ($q) => $q->where('sku', $sku))
            ->first();
        if ($listing) {
            $listing->update(['allocated_quantity' => max(0, $listing->allocated_quantity - $quantity)]);
        }
    }
}
