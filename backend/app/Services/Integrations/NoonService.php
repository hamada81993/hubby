<?php

namespace App\Services\Integrations;

use App\Models\Integration;
use App\Models\Store;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * noon Partner API (https://noon-docs.noonpartners.dev).
 *
 * The seller creates a Service Account in noon partners (Access → API Users) and gets a JSON
 * key file. We store:
 *   - access_token → the whole key file (key_id, private_key, project_code…)
 *   - shop_domain  → the project code (PRJ…)
 *
 * Signing in: an RS256 JWT made from the key is exchanged at /identity/public/v1/api/login
 * for session cookies, which every later call carries. Everything is pulled or pushed by us;
 * no webhooks are involved.
 *
 * What the API covers: stock and prices by partner SKU, and orders of FBPI warehouses
 * (fulfilled by the partner through the integration). It has no call that lists a seller's
 * whole catalogue, so products come from the master store and are matched to noon by SKU.
 */
class NoonService extends BaseIntegrationService
{
    /** How far back an order pull looks. */
    private const ORDER_WINDOW_DAYS = 14;

    /** Upper bound on pages (50 orders each) read per warehouse in one pull. */
    private const MAX_ORDER_PAGES = 20;

    private function apiBase(): string
    {
        return rtrim(config('services.noon.base_url', 'https://noon-api-gateway.noon.partners'), '/');
    }

    private function countryCode(): string
    {
        return strtolower(config('services.noon.country', 'sa'));
    }

    /** The key file is the credential: nothing to redirect to. */
    public function getAuthUrl(): string
    {
        return '';
    }

    /** Not applicable: the key file is uploaded on the connect screen. */
    public function exchangeCode(string $code): array
    {
        return [];
    }

    /** Sessions are renewed on demand (see session()), the key itself does not expire by default. */
    public function refreshToken(Integration $integration): void
    {
        Cache::forget($this->sessionKey($integration));
    }

    /**
     * The fields of a service-account key file, or null when the text is not one.
     *
     * @return array{key_id: string, private_key: string, project_code: ?string}|null
     */
    public static function parseKey(?string $json): ?array
    {
        $key = json_decode((string) $json, true);
        if (! is_array($key) || empty($key['key_id']) || empty($key['private_key'])) {
            return null;
        }

        return [
            'key_id' => (string) $key['key_id'],
            'private_key' => (string) $key['private_key'],
            'project_code' => isset($key['project_code']) ? (string) $key['project_code'] : null,
        ];
    }

    private function sessionKey(Integration $integration): string
    {
        return "noon.session.{$integration->id}";
    }

    /** A fresh single-use login token: RS256 over sub (key id), iat and jti. */
    private function loginToken(array $key): string
    {
        $encode = fn (string $raw) => rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
        $unsigned = $encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])).'.'.$encode(json_encode([
            'sub' => $key['key_id'],
            'iat' => time(),
            'jti' => (string) Str::uuid(),
        ]));

        if (! openssl_sign($unsigned, $signature, $key['private_key'], OPENSSL_ALGO_SHA256)) {
            throw new \RuntimeException('The noon key file could not be used to sign in. Download a new key and connect again.');
        }

        return $unsigned.'.'.$encode($signature);
    }

    /** The Cookie header of a signed-in session, signing in when there is none. */
    private function session(Integration $integration): string
    {
        // noon keeps a session for 30 days; a day here keeps us far inside that.
        return Cache::remember($this->sessionKey($integration), now()->addDay(), function () use ($integration) {
            $key = self::parseKey($integration->access_token);
            if (! $key) {
                throw new \RuntimeException('The noon key file is missing or not valid.');
            }

            $response = Http::withHeaders(['User-Agent' => 'Hubby/1.0'])
                ->acceptJson()
                ->post($this->apiBase().'/identity/public/v1/api/login', array_filter([
                    'token' => $this->loginToken($key),
                    'default_project_code' => $integration->shop_domain ?: $key['project_code'],
                ]));

            // Only the name=value part of each Set-Cookie is sent back.
            $cookies = collect($response->headers()['Set-Cookie'] ?? [])
                ->map(fn ($cookie) => trim(explode(';', $cookie)[0]))
                ->filter()
                ->implode('; ');

            if ($response->failed() || $cookies === '') {
                throw new \RuntimeException('noon did not accept the key file: '.Str::limit($response->body(), 200));
            }

            return $cookies;
        });
    }

    /** One signed-in call. A rejected session is renewed once and the call repeated. */
    private function call(Integration $integration, string $method, string $path, array $body = [], array $query = []): Response
    {
        $send = function () use ($integration, $method, $path, $body, $query) {
            $request = Http::withHeaders([
                'User-Agent' => 'Hubby/1.0',
                'Cookie' => $this->session($integration),
            ])->acceptJson();
            $url = $this->apiBase().$path.($query ? '?'.http_build_query($query) : '');

            return $method === 'GET' ? $request->get($url) : $request->post($url, $body);
        };

        $response = $send();
        if (in_array($response->status(), [401, 403], true)) {
            Cache::forget($this->sessionKey($integration));
            $response = $send();
        }

        return $response;
    }

    /** Checks the key by asking noon who we are. Throws with noon's reason when it is refused. */
    public function verify(Integration $integration): void
    {
        Cache::forget($this->sessionKey($integration));
        $response = $this->call($integration, 'GET', '/identity/v1/whoami');
        if ($response->failed()) {
            throw new \RuntimeException('noon did not accept the key file: '.Str::limit($response->body(), 200));
        }
    }

    /**
     * Codes of the seller's active warehouses. Cached: noon allows few warehouse calls a minute.
     *
     * @return array<int, string>
     */
    public function warehouseCodes(Integration $integration): array
    {
        return Cache::remember("noon.warehouses.{$integration->id}", now()->addHour(), function () use ($integration) {
            $codes = [];
            $next = null;
            do {
                $response = $this->call($integration, 'POST', '/warehouse-platform/v1/warehouses/list', array_filter(['next_token' => $next]));
                if ($response->failed()) {
                    throw new \RuntimeException('noon warehouses could not be read: '.Str::limit($response->body(), 200));
                }
                foreach ($response->json('warehouses') ?? [] as $warehouse) {
                    if ($warehouse['is_active'] ?? false) {
                        $codes[] = $warehouse['warehouse_code'];
                    }
                }
                $next = $response->json('next_token');
            } while (! empty($next));

            return $codes;
        });
    }

    /** FBPI orders of every active warehouse, created inside the recent window. */
    public function fetchOrders(Store $store, array $params = []): array
    {
        $integration = $store->integration;
        $orders = [];

        foreach ($this->warehouseCodes($integration) as $warehouse) {
            $next = '';
            $pages = 0;
            do {
                $response = $this->call($integration, 'POST', '/fbpi/v1/fbpi-orders/list', [
                    'warehouse_code' => $warehouse,
                    'created_after' => now()->subDays(self::ORDER_WINDOW_DAYS)->utc()->format('Y-m-d\TH:i:s\Z'),
                ], ['next_token' => $next]);

                if ($response->failed()) {
                    // A warehouse outside the FBPI programme has no order list; the others still count.
                    Log::warning("noon orders not read for warehouse {$warehouse}: ".Str::limit($response->body(), 200));
                    break;
                }
                array_push($orders, ...($response->json('orders') ?? []));
                $next = (string) $response->json('next_token');
            } while ($next !== '' && ++$pages < self::MAX_ORDER_PAGES);
        }

        return $orders;
    }

    /** noon has no call that lists the catalogue: products come from the master store. */
    public function fetchProducts(Store $store): array
    {
        return [];
    }

    /** noon is a sales channel here, never the stock master. */
    public function fetchInventory(Store $store): array
    {
        return [];
    }

    /** Sets the absolute quantity of a partner SKU in the seller's first active warehouse. */
    public function updateInventory(Store $store, string $sku, int $qty): bool
    {
        $warehouse = $this->warehouseCodes($store->integration)[0] ?? null;
        if (! $warehouse) {
            Log::error("noon updateInventory: store {$store->id} has no active warehouse.");

            return false;
        }

        $response = $this->call($store->integration, 'POST', '/stock/v1/stock-update', [
            'items' => [['warehouse_code' => $warehouse, 'partner_sku' => $sku, 'qty' => max(0, $qty)]],
        ]);

        return $this->accepted($response, "updateInventory {$sku}");
    }

    /** Sets the selling price of a partner SKU in the configured country. */
    public function updatePrice(Store $store, string $sku, float $price): bool
    {
        $response = $this->call($store->integration, 'POST', '/pricing/v1/pricing/upsert', [
            'items' => [['partner_sku' => $sku, 'country_code' => $this->countryCode(), 'price' => $price]],
        ]);

        return $this->accepted($response, "updatePrice {$sku}");
    }

    /** noon also returns a status per item; it is logged so a refused SKU can be traced. */
    private function accepted(Response $response, string $what): bool
    {
        if ($response->failed()) {
            Log::error("noon {$what} failed: ".Str::limit($response->body(), 300));

            return false;
        }
        if ($message = $response->json('items.0.status.message')) {
            Log::info("noon {$what}: {$message}");
        }

        return true;
    }

    /** Order progress on noon moves through shipments, which Hubby does not create yet. */
    public function updateOrderStatus(Store $store, string $externalId, string $status): bool
    {
        Log::info("noon updateOrderStatus is not supported (order {$externalId}).");

        return false;
    }

    public function cancelOrder(Store $store, string $externalId): bool
    {
        return $this->updateOrderStatus($store, $externalId, 'cancelled');
    }
}
