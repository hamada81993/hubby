<?php

namespace App\Services\Integrations;

use App\Models\Store;
use App\Models\Integration;
use App\Services\Integrations\Contracts\SupportsPricePush;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Trendyol Marketplace API integration (Saudi Arabia and the Gulf first, Türkiye too).
 *
 * Trendyol does NOT use OAuth — the merchant creates an API Key + API Secret in
 * the Seller Center and provides their Supplier (Seller) ID. We store:
 *   - access_token  → API Key
 *   - refresh_token → API Secret
 *   - shop_domain / store.domain → Supplier ID
 *
 * Auth is HTTP Basic (apiKey:apiSecret) on https://apigw.trendyol.com/integration/...
 * Every country shares that host; the storeFrontCode header picks the market
 * (SA, AE, KW…). Without it Trendyol answers for Türkiye.
 */
class TrendyolService extends BaseIntegrationService implements SupportsPricePush
{
    private function apiBase(): string
    {
        return rtrim(config('services.trendyol.base_url', 'https://apigw.trendyol.com'), '/');
    }

    /** $area is the API family the path belongs to: order, product or inventory. */
    private function sellerEndpoint(Store $store, string $area, string $path): string
    {
        $sellerId = $store->integration->shop_domain ?? $store->domain;

        return $this->apiBase() . "/integration/{$area}/sellers/{$sellerId}" . $path;
    }

    /** API keys are static — there is no OAuth redirect. */
    public function getAuthUrl(): string
    {
        return '';
    }

    /** Not applicable: credentials are entered manually, not via a code exchange. */
    public function exchangeCode(string $code): array
    {
        return [];
    }

    /** Trendyol API keys do not expire, so there is nothing to refresh. */
    public function refreshToken(Integration $integration): void
    {
        // no-op
    }

    /**
     * Basic auth (apiKey:apiSecret). Trendyol also recommends a User-Agent of
     * "{supplierId} - SelfIntegration".
     */
    protected function getHttpClient(Integration $integration)
    {
        $apiKey = $integration->access_token;
        $apiSecret = $integration->refresh_token ?? '';
        $supplierId = $integration->shop_domain ?? '';

        return Http::withBasicAuth($apiKey, $apiSecret)
            ->withHeaders([
                'User-Agent' => trim("{$supplierId} - SelfIntegration"),
                // The market chosen for the store; without the header Trendyol answers for Türkiye.
                'storeFrontCode' => strtoupper($integration->store?->market ?: config('services.trendyol.storefront', 'SA')),
            ]);
    }

    public function fetchOrders(Store $store, array $params = []): array
    {
        $response = $this->getHttpClient($store->integration)
            ->get($this->sellerEndpoint($store, 'order', '/orders'), $params + [
                // Most recently changed first, so a scheduled pull sees new and updated orders.
                'size' => 200,
                'orderByField' => 'PackageLastModifiedDate',
                'orderByDirection' => 'DESC',
            ]);

        if ($response->failed()) {
            Log::error('Trendyol fetchOrders failed: ' . $response->body());
            return [];
        }

        // Trendyol paginates orders under "content".
        return $response->json('content') ?? $response->json('data') ?? [];
    }

    public function fetchProducts(Store $store): array
    {
        $response = $this->getHttpClient($store->integration)
            ->get($this->sellerEndpoint($store, 'product', '/products'), ['size' => 1000]);

        if ($response->failed()) {
            Log::error('Trendyol fetchProducts failed: ' . $response->body());
            return [];
        }

        return $response->json('content') ?? $response->json('data') ?? [];
    }

    public function fetchInventory(Store $store): array
    {
        $levels = [];

        foreach ($this->fetchProducts($store) as $product) {
            $sku = $product['stockCode'] ?? $product['barcode'] ?? $product['sku'] ?? null;
            if (! empty($sku)) {
                $levels[] = [
                    'sku' => $sku,
                    'available' => $product['quantity'] ?? $product['stock'] ?? 0,
                ];
            }
        }

        return $levels;
    }

    public function updateInventory(Store $store, string $sku, int $qty): bool
    {
        // Trendyol updates stock (and price) in bulk via price-and-inventory.
        $response = $this->getHttpClient($store->integration)
            ->post($this->sellerEndpoint($store, 'inventory', '/products/price-and-inventory'), [
                'items' => [
                    ['barcode' => $sku, 'quantity' => $qty],
                ],
            ]);

        if ($response->failed()) {
            Log::error("Trendyol updateInventory failed for {$sku}: " . $response->body());
            return false;
        }

        return true;
    }

    public function updatePrice(Store $store, string $sku, float $price): bool
    {
        $response = $this->getHttpClient($store->integration)
            ->post($this->sellerEndpoint($store, 'inventory', '/products/price-and-inventory'), [
                'items' => [['barcode' => $sku, 'salePrice' => $price, 'listPrice' => $price]],
            ]);

        if ($response->failed()) {
            Log::error("Trendyol updatePrice failed for {$sku}: " . $response->body());
            return false;
        }

        return true;
    }

    public function updateOrderStatus(Store $store, string $externalId, string $status): bool
    {
        // Trendyol shipment-package status updates live under /shipment-packages.
        $response = $this->getHttpClient($store->integration)
            ->put($this->sellerEndpoint($store, 'order', "/shipment-packages/{$externalId}"), [
                'status' => strtoupper($status),
            ]);

        if ($response->failed()) {
            Log::error("Trendyol updateOrderStatus failed for {$externalId}: " . $response->body());
            return false;
        }

        return true;
    }

    public function cancelOrder(Store $store, string $externalId): bool
    {
        return $this->updateOrderStatus($store, $externalId, 'Cancelled');
    }
}
