<?php

namespace App\Services\Integrations;

use App\Models\Integration;
use App\Models\Store;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Odoo as a catalogue source: products, variants, prices and stock are read from the
 * merchant's Odoo and nothing is written back.
 *
 * Credentials live on the store's integration:
 *  - `access_token`  → an Odoo API key (Preferences → Account Security → New API Key)
 *  - `refresh_token` → the login (email) the key belongs to
 *  - `stores.domain` → the Odoo host, optionally with `?db=<database>`
 *
 * Two transports are tried in order. Odoo 19+ exposes the JSON-2 API, which needs only the
 * key. Older versions use the classic JSON-RPC external API, which also needs the database
 * name and the login.
 */
class OdooService extends BaseIntegrationService
{
    private const PAGE = 200;

    /** Resolved once per store, then reused for every call in the same sync. */
    private array $session = [];

    public function getAuthUrl(): string
    {
        // Odoo connects with an API key, not an OAuth redirect.
        return '';
    }

    public function exchangeCode(string $code): array
    {
        return [];
    }

    public function refreshToken(Integration $integration): void
    {
        // API keys do not expire on a refresh cycle.
    }

    public function fetchOrders(Store $store, array $params = []): array
    {
        // Odoo is connected as the product source, not as a sales channel.
        return [];
    }

    /**
     * Returns products already in Hubby's shape (see SyncProductsJob::mapProductData):
     * name, sku, description, price, stock, image_url and variants.
     */
    public function fetchProducts(Store $store): array
    {
        $templates = $this->readAll(
            $store,
            'product.template',
            [['sale_ok', '=', true]],
            ['name', 'default_code', 'barcode', 'list_price', 'description_sale'],
        );
        if ($templates === []) {
            return [];
        }

        $variants = $this->readAll(
            $store,
            'product.product',
            [['product_tmpl_id', 'in', array_column($templates, 'id')]],
            ['product_tmpl_id', 'display_name', 'default_code', 'barcode', 'lst_price'],
        );

        $byTemplate = [];
        foreach ($variants as $variant) {
            // Many-to-one fields come back as [id, display name].
            $templateId = is_array($variant['product_tmpl_id']) ? $variant['product_tmpl_id'][0] : $variant['product_tmpl_id'];
            $byTemplate[$templateId][] = $variant;
        }

        $products = [];
        foreach ($templates as $template) {
            $rows = $byTemplate[$template['id']] ?? [];
            $mapped = array_map(fn (array $v) => [
                'external_id' => (string) $v['id'],
                'name' => (string) ($v['display_name'] ?? ''),
                'sku' => $this->text($v['default_code'] ?? null) ?? $this->text($v['barcode'] ?? null) ?? 'ODOO-VAR-'.$v['id'],
                'price' => (float) ($v['lst_price'] ?? $template['list_price'] ?? 0),
                'stock' => (int) round((float) ($v['qty_available'] ?? 0)),
            ], $rows);

            $products[] = [
                'name' => (string) $template['name'],
                'sku' => $this->text($template['default_code'] ?? null)
                    ?? $this->text($template['barcode'] ?? null)
                    ?? ($mapped[0]['sku'] ?? 'ODOO-'.$template['id']),
                'description' => $this->text($template['description_sale'] ?? null),
                'price' => (float) ($template['list_price'] ?? 0),
                'stock' => array_sum(array_column($mapped, 'stock')),
                // Odoo serves product images only to a signed-in session, so there is no
                // address the dashboard could load one from.
                'image_url' => null,
                'variants' => $mapped,
            ];
        }

        return $products;
    }

    public function fetchInventory(Store $store): array
    {
        $levels = [];
        foreach ($this->fetchProducts($store) as $product) {
            foreach ($product['variants'] as $variant) {
                $levels[] = ['sku' => $variant['sku'], 'quantity' => $variant['stock']];
            }
        }

        return $levels;
    }

    public function updateInventory(Store $store, string $sku, int $qty): bool
    {
        // Read-only by design: Hubby never changes stock inside the merchant's Odoo.
        return true;
    }

    public function updateOrderStatus(Store $store, string $externalId, string $status): bool
    {
        return true;
    }

    public function cancelOrder(Store $store, string $externalId): bool
    {
        return true;
    }

    /**
     * Read every record of a model, a page at a time. Stock is asked for on product
     * variants and dropped if this Odoo has no Inventory app (the field does not exist).
     */
    protected function readAll(Store $store, string $model, array $domain, array $fields): array
    {
        $withStock = $model === 'product.product';
        $records = [];
        $offset = 0;

        while (true) {
            try {
                $page = $this->call($store, $model, 'search_read', [
                    'domain' => $domain,
                    'fields' => $withStock ? [...$fields, 'qty_available'] : $fields,
                    'limit' => self::PAGE,
                    'offset' => $offset,
                    'order' => 'id',
                ]);
            } catch (RuntimeException $e) {
                if (! $withStock) {
                    throw $e;
                }
                // Ask again without the stock field.
                $withStock = false;

                continue;
            }

            $records = [...$records, ...$page];
            if (count($page) < self::PAGE) {
                return $records;
            }
            $offset += self::PAGE;
        }
    }

    /** One model method call, over whichever transport this Odoo answers on. */
    protected function call(Store $store, string $model, string $method, array $kwargs): array
    {
        $session = $this->session($store);

        if ($session['transport'] === 'json2') {
            $response = Http::withToken($session['key'])
                ->acceptJson()
                ->timeout(30)
                ->post("{$session['base']}/json/2/{$model}/{$method}", $kwargs);

            if ($response->failed()) {
                throw new RuntimeException("Odoo refused {$model}.{$method}: ".$this->errorText($response->json(), $response->status()));
            }

            return $response->json() ?? [];
        }

        $domain = $kwargs['domain'] ?? [];
        unset($kwargs['domain']);

        return $this->rpc($session['base'], 'object', 'execute_kw', [
            $session['db'], $session['uid'], $session['key'], $model, $method, [$domain], $kwargs,
        ]) ?? [];
    }

    /** Work out the host, key and transport for a store, signing in if the classic API is used. */
    protected function session(Store $store): array
    {
        if (isset($this->session[$store->id])) {
            return $this->session[$store->id];
        }

        $integration = $store->integration;
        $key = (string) $integration?->access_token;
        $login = (string) $integration?->refresh_token;
        [$host, $query] = array_pad(explode('?', (string) $store->domain, 2), 2, '');
        parse_str($query, $options);
        $base = 'https://'.rtrim($host, '/');

        // Odoo 19 and later: the key alone is enough.
        $probe = Http::withToken($key)->acceptJson()->timeout(20)
            ->post("{$base}/json/2/res.users/context_get", []);
        if ($probe->successful()) {
            return $this->session[$store->id] = ['transport' => 'json2', 'base' => $base, 'key' => $key];
        }
        if ($probe->status() === 401 || $probe->status() === 403) {
            throw new RuntimeException('Odoo rejected the API key. Create a new key under Preferences → Account Security and reconnect.');
        }

        // Older versions: database + login + key over JSON-RPC.
        if ($login === '') {
            throw new RuntimeException('This Odoo version needs the login email as well as the API key.');
        }
        $db = $options['db'] ?? $this->guessDatabase($base, $host);
        $uid = $this->rpc($base, 'common', 'login', [$db, $login, $key]);
        if (! $uid) {
            throw new RuntimeException("Odoo did not accept this login and API key for database \"{$db}\".");
        }

        return $this->session[$store->id] = [
            'transport' => 'jsonrpc', 'base' => $base, 'key' => $key, 'db' => $db, 'uid' => (int) $uid,
        ];
    }

    /** The database to sign in to: the only one the server lists, or the odoo.com subdomain. */
    protected function guessDatabase(string $base, string $host): string
    {
        try {
            $list = $this->rpc($base, 'db', 'list', []);
            if (is_array($list) && count($list) === 1) {
                return (string) $list[0];
            }
        } catch (RuntimeException) {
            // Listing databases is switched off on most hosted instances; fall through.
        }

        if (preg_match('/^([a-z0-9-]+)\.odoo\.com$/i', $host, $m)) {
            return $m[1];
        }

        throw new RuntimeException('Could not tell which Odoo database to use. Add it to the URL, for example: your-company.example.com?db=your_database');
    }

    /** A classic JSON-RPC call to /jsonrpc. */
    protected function rpc(string $base, string $service, string $method, array $args): mixed
    {
        $response = Http::acceptJson()->timeout(30)->post("{$base}/jsonrpc", [
            'jsonrpc' => '2.0',
            'method' => 'call',
            'params' => ['service' => $service, 'method' => $method, 'args' => $args],
            'id' => 1,
        ]);

        if ($response->failed()) {
            throw new RuntimeException("Could not reach Odoo at {$base} (HTTP {$response->status()}).");
        }
        if ($response->json('error')) {
            throw new RuntimeException('Odoo error: '.$this->errorText($response->json('error'), $response->status()));
        }

        return $response->json('result');
    }

    private function errorText(mixed $error, int $status): string
    {
        if (is_array($error)) {
            return (string) ($error['data']['message'] ?? $error['message'] ?? "HTTP {$status}");
        }

        return "HTTP {$status}";
    }

    /** Odoo returns `false` for an empty text field. */
    private function text(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
