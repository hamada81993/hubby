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

    /** The most records one sync reads from a model, so a misbehaving server cannot keep it busy for ever. */
    private const MAX_RECORDS = 50000;

    /** Resolved once per store, then reused for every call in the same sync. */
    private array $session = [];

    /**
     * Turns a hostname into its IPv4 addresses. Swappable so tests do not depend on DNS.
     *
     * @var null|\Closure(string): array<int, string>
     */
    public static ?\Closure $resolver = null;

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
                // Odoo's cost price, when this user is allowed to see it.
                'cost' => isset($v['standard_price']) ? (float) $v['standard_price'] : null,
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

    /**
     * Odoo's warehouses and how many units of each product sit in each.
     *
     * @return array{warehouses: array<int, array{id: int, name: string, code: string}>, levels: array<int, array{warehouse_id: int, product_id: string, quantity: int}>}
     */
    public function fetchWarehouseStock(Store $store): array
    {
        $warehouses = $this->readAll($store, 'stock.warehouse', [], ['name', 'code']);
        if ($warehouses === []) {
            return ['warehouses' => [], 'levels' => []];
        }

        // Internal locations only: stock at customers, suppliers or in transit is not on the shelf.
        $locations = $this->readAll($store, 'stock.location', [['usage', '=', 'internal']], ['warehouse_id']);
        $warehouseOf = [];
        foreach ($locations as $location) {
            if (is_array($location['warehouse_id'] ?? null)) {
                $warehouseOf[$location['id']] = (int) $location['warehouse_id'][0];
            }
        }

        $totals = [];
        foreach ($this->readAll($store, 'stock.quant', [['location_id', 'in', array_keys($warehouseOf)]], ['product_id', 'location_id', 'quantity']) as $quant) {
            $warehouse = $warehouseOf[$quant['location_id'][0] ?? 0] ?? null;
            $product = is_array($quant['product_id'] ?? null) ? (string) $quant['product_id'][0] : null;
            if ($warehouse && $product) {
                $totals[$warehouse][$product] = ($totals[$warehouse][$product] ?? 0) + (float) $quant['quantity'];
            }
        }

        $levels = [];
        foreach ($totals as $warehouse => $products) {
            foreach ($products as $product => $quantity) {
                $levels[] = ['warehouse_id' => $warehouse, 'product_id' => (string) $product, 'quantity' => (int) round($quantity)];
            }
        }

        return [
            'warehouses' => array_map(fn ($w) => ['id' => (int) $w['id'], 'name' => (string) $w['name'], 'code' => (string) ($w['code'] ?: 'WH'.$w['id'])], $warehouses),
            'levels' => $levels,
        ];
    }

    /**
     * Odoo's price lists with the price of each product they set directly.
     *
     * Rules that fix a price or take a percentage off the sales price are read, for a variant,
     * a product or every product, at quantity one and valid today. Formula rules and rules per
     * category are left out, and counted in `skipped`.
     *
     * @return array<int, array{id: string, name: string, currency: ?string, skipped: int, prices: array<string, float>}>
     */
    public function fetchPriceLists(Store $store): array
    {
        $lists = $this->readAll($store, 'product.pricelist', [], ['name', 'currency_id']);
        if ($lists === []) {
            return [];
        }
        $rules = $this->readAll($store, 'product.pricelist.item', [['pricelist_id', 'in', array_column($lists, 'id')]], [
            'pricelist_id', 'applied_on', 'product_tmpl_id', 'product_id', 'compute_price',
            'fixed_price', 'percent_price', 'min_quantity', 'date_start', 'date_end',
        ]);
        $variants = $this->readAll($store, 'product.product', [['sale_ok', '=', true]], ['product_tmpl_id', 'lst_price']);

        $now = now()->utc()->format('Y-m-d H:i:s');
        // Most specific rule wins: variant, then product, then every product.
        $rank = ['0_product_variant' => 0, '1_product' => 1, '3_global' => 2];
        $byList = [];
        $skipped = [];
        foreach ($rules as $rule) {
            $list = $rule['pricelist_id'][0] ?? 0;
            $usable = isset($rank[$rule['applied_on'] ?? ''])
                && in_array($rule['compute_price'] ?? '', ['fixed', 'percentage'], true)
                && (float) ($rule['min_quantity'] ?? 0) <= 1
                && (empty($rule['date_start']) || $rule['date_start'] <= $now)
                && (empty($rule['date_end']) || $rule['date_end'] >= $now);
            if (! $usable) {
                $skipped[$list] = ($skipped[$list] ?? 0) + 1;

                continue;
            }
            $byList[$list][] = $rule;
        }

        $result = [];
        foreach ($lists as $list) {
            $own = $byList[$list['id']] ?? [];
            usort($own, fn ($a, $b) => $rank[$a['applied_on']] <=> $rank[$b['applied_on']]);
            $prices = [];
            foreach ($variants as $variant) {
                $template = $variant['product_tmpl_id'][0] ?? null;
                foreach ($own as $rule) {
                    $applies = match ($rule['applied_on']) {
                        '0_product_variant' => ($rule['product_id'][0] ?? null) === $variant['id'],
                        '1_product' => ($rule['product_tmpl_id'][0] ?? null) === $template,
                        default => true,
                    };
                    if ($applies) {
                        $prices[(string) $variant['id']] = $rule['compute_price'] === 'fixed'
                            ? (float) $rule['fixed_price']
                            : round((float) ($variant['lst_price'] ?? 0) * (1 - (float) $rule['percent_price'] / 100), 2);
                        break;
                    }
                }
            }
            $result[] = [
                'id' => (string) $list['id'],
                'name' => (string) $list['name'],
                'currency' => is_array($list['currency_id'] ?? null) ? (string) $list['currency_id'][1] : null,
                'skipped' => $skipped[$list['id']] ?? 0,
                'prices' => $prices,
            ];
        }

        return $result;
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
     * Read every record of a model, a page at a time. Stock and cost are asked for on product
     * variants and dropped, one at a time, if this Odoo refuses them: stock when there is no
     * Inventory app, cost when the key's user may not see cost prices.
     */
    protected function readAll(Store $store, string $model, array $domain, array $fields): array
    {
        // Optional fields, tried together and given up one by one from the end.
        $optional = $model === 'product.product' ? ['qty_available', 'standard_price'] : [];
        $records = [];
        $offset = 0;

        while (true) {
            try {
                $page = $this->call($store, $model, 'search_read', [
                    'domain' => $domain,
                    'fields' => [...$fields, ...$optional],
                    'limit' => self::PAGE,
                    'offset' => $offset,
                    'order' => 'id',
                ]);
            } catch (RuntimeException $e) {
                if ($optional === []) {
                    throw $e;
                }
                array_pop($optional);

                continue;
            }

            if (! array_is_list($page) || count($page) > self::PAGE) {
                throw new RuntimeException('Odoo returned an unexpected list of records.');
            }
            $records = [...$records, ...$page];
            if (count($page) < self::PAGE) {
                return $records;
            }
            $offset += self::PAGE;
            if ($offset >= self::MAX_RECORDS) {
                throw new RuntimeException('This Odoo has more than '.self::MAX_RECORDS.' products, which is above what one sync reads.');
            }
        }
    }

    /** One model method call, over whichever transport this Odoo answers on. */
    protected function call(Store $store, string $model, string $method, array $kwargs): array
    {
        $session = $this->session($store);

        if ($session['transport'] === 'json2') {
            $response = $this->http($session)->withToken($session['key'])
                ->post("{$session['base']}/json/2/{$model}/{$method}", $kwargs);

            if ($response->failed()) {
                throw new RuntimeException("Odoo refused {$model}.{$method}: ".$this->errorText($response->json(), $response->status()));
            }

            return $response->json() ?? [];
        }

        $domain = $kwargs['domain'] ?? [];
        unset($kwargs['domain']);

        return $this->rpc($session, 'object', 'execute_kw', [
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
        [$host, $options, $ip] = $this->safeHost((string) $store->domain);
        $target = ['base' => "https://{$host}", 'host' => $host, 'ip' => $ip, 'key' => $key];

        // Odoo 19 and later: the key alone is enough.
        $probe = $this->http($target)->withToken($key)->post("{$target['base']}/json/2/res.users/context_get", []);
        if ($probe->successful()) {
            return $this->session[$store->id] = ['transport' => 'json2'] + $target;
        }
        if ($probe->status() === 401 || $probe->status() === 403) {
            throw new RuntimeException('Odoo rejected the API key. Create a new key under Preferences → Account Security and reconnect.');
        }

        // Older versions: database + login + key over JSON-RPC.
        if ($login === '') {
            throw new RuntimeException('This Odoo version needs the login email as well as the API key.');
        }
        $db = $options['db'] ?? $this->guessDatabase($target);
        $uid = $this->rpc($target, 'common', 'login', [$db, $login, $key]);
        if (! $uid) {
            throw new RuntimeException('Odoo did not accept this login and API key for that database.');
        }

        return $this->session[$store->id] = ['transport' => 'jsonrpc', 'db' => (string) $db, 'uid' => (int) $uid] + $target;
    }

    /**
     * The merchant types the Odoo address, so it is checked before this server calls it:
     * a plain public hostname only, never an internal or reserved address. The request is
     * then pinned to the address that was checked, so a second DNS answer cannot redirect it.
     *
     * @return array{0: string, 1: array<string, mixed>, 2: string}
     */
    protected function safeHost(string $domain): array
    {
        [$address, $query] = array_pad(explode('?', $domain, 2), 2, '');
        parse_str($query, $options);
        $parts = parse_url('https://'.trim($address));

        $extras = array_diff(array_keys($parts ?: []), ['scheme', 'host']);
        if (! $parts || empty($parts['host']) || $extras !== []) {
            throw new RuntimeException('Enter the Odoo address as a hostname only, for example your-company.odoo.com.');
        }

        $host = strtolower($parts['host']);
        $resolve = self::$resolver
            ?? fn (string $name): array => filter_var($name, FILTER_VALIDATE_IP) ? [$name] : (gethostbynamel($name) ?: []);
        $addresses = $resolve($host);
        if ($addresses === []) {
            throw new RuntimeException("Could not find the Odoo server {$host}.");
        }
        foreach ($addresses as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                throw new RuntimeException('That Odoo address is not reachable from Hubby. Use the public address of your Odoo.');
            }
        }

        return [$host, $options, $addresses[0]];
    }

    /** A client for one checked Odoo host: pinned to its address, and it does not follow redirects. */
    protected function http(array $target)
    {
        return Http::acceptJson()->timeout(30)->withOptions([
            'allow_redirects' => false,
            'curl' => [CURLOPT_RESOLVE => ["{$target['host']}:443:{$target['ip']}"]],
        ]);
    }

    /** The database to sign in to: the only one the server lists, or the odoo.com subdomain. */
    protected function guessDatabase(array $target): string
    {
        try {
            $list = $this->rpc($target, 'db', 'list', []);
            if (is_array($list) && count($list) === 1) {
                return (string) $list[0];
            }
        } catch (RuntimeException) {
            // Listing databases is switched off on most hosted instances; fall through.
        }

        if (preg_match('/^([a-z0-9-]+)\.odoo\.com$/i', $target['host'], $m)) {
            return $m[1];
        }

        throw new RuntimeException('Could not tell which Odoo database to use. Add it to the URL, for example: your-company.example.com?db=your_database');
    }

    /** A classic JSON-RPC call to /jsonrpc. */
    protected function rpc(array $target, string $service, string $method, array $args): mixed
    {
        $response = $this->http($target)->post("{$target['base']}/jsonrpc", [
            'jsonrpc' => '2.0',
            'method' => 'call',
            'params' => ['service' => $service, 'method' => $method, 'args' => $args],
            'id' => 1,
        ]);

        if ($response->failed()) {
            throw new RuntimeException("Could not reach Odoo at {$target['host']} (HTTP {$response->status()}).");
        }
        if ($response->json('error')) {
            throw new RuntimeException('Odoo error: '.$this->errorText($response->json('error'), $response->status()));
        }

        return $response->json('result');
    }

    private function errorText(mixed $error, int $status): string
    {
        if (is_array($error)) {
            // Odoo's own short reason only, never a raw response body.
            return mb_substr((string) ($error['data']['message'] ?? $error['message'] ?? "HTTP {$status}"), 0, 160);
        }

        return "HTTP {$status}";
    }

    /** Odoo returns `false` for an empty text field. */
    private function text(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
