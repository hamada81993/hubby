<?php

namespace App\Http\Controllers;

use App\Jobs\SyncOrdersJob;
use App\Jobs\SyncProductsJob;
use App\Models\Organization;
use App\Models\Store;
use App\Models\SyncLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class StoreController extends Controller
{
    public function index(Request $request)
    {
        $organizationId = $request->header('X-Organization-Id');
        $stores = Store::where('organization_id', $organizationId)->with('integration')->get();

        return response()->json($stores);
    }

    /**
     * Tell the dashboard which platforms have one-click OAuth available — i.e.
     * the operator has configured that platform's app client keys in the
     * environment. Platforms without keys are connectable by token only.
     */
    public function connectOptions()
    {
        // Config key that proves a platform's OAuth app is configured.
        $oauthKeys = [
            'shopify' => 'services.shopify.api_key',
            'salla' => 'services.salla.client_id',
            'amazon' => 'services.amazon.client_id',
            'noon' => 'services.noon.client_id',
        ];

        $oauthEnabled = [];
        foreach ($oauthKeys as $platform => $key) {
            $oauthEnabled[$platform] = filled(config($key));
        }

        return response()->json(['oauth_enabled' => $oauthEnabled]);
    }

    /**
     * Connect a merchant's store from the dashboard using their own API
     * credentials. This is the self-serve path a tenant uses — no platform-app
     * OAuth secrets required from the operator. The OAuth redirect flow
     * (OAuthController) is an optional convenience layered on top.
     */
    public function connect(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'platform' => 'required|in:shopify,woocommerce,salla,zid,amazon,noon,trendyol',
            'domain' => 'required|string|max:255',
            'access_token' => 'required|string',
            // Some platforms need a second secret (e.g. WooCommerce consumer secret).
            'api_secret' => 'nullable|string',
        ]);

        $organizationId = $request->header('X-Organization-Id');

        // Normalise the domain (strip scheme/trailing slash) so API base URLs build cleanly.
        $domain = rtrim(preg_replace('#^https?://#', '', trim($data['domain'])), '/');

        $store = Store::create([
            'organization_id' => $organizationId,
            'name' => $data['name'],
            'platform' => $data['platform'],
            'domain' => $domain,
            'status' => 'syncing',
        ]);

        $store->integration()->create([
            'access_token' => $data['access_token'],
            'refresh_token' => $data['api_secret'] ?? null,
            'shop_domain' => $domain,
        ]);

        // Pull the merchant's catalog and orders in the background.
        SyncProductsJob::dispatch($store);
        SyncOrdersJob::dispatch($store);

        return response()->json([
            'message' => 'Store connected. Initial sync started.',
            'store' => $store->load('integration'),
        ], 201);
    }

    public function setMaster(Request $request, $id)
    {
        $organizationId = $request->header('X-Organization-Id');
        $store = Store::where('organization_id', $organizationId)->findOrFail($id);
        DB::transaction(function () use ($organizationId, $store) {
            Organization::whereKey($organizationId)->lockForUpdate()->firstOrFail();
            Store::where('organization_id', $organizationId)->update(['is_master' => false]);
            $store->update(['is_master' => true, 'safety_stock' => 0]);
        });

        return response()->json(['message' => "{$store->name} is now the master store", 'store' => $store]);
    }

    public function sync(Request $request, $id)
    {
        $organizationId = $request->header('X-Organization-Id');
        $store = Store::where('organization_id', $organizationId)->findOrFail($id);

        $this->queueSync($store);

        return response()->json(['message' => 'Syncing started in the background']);
    }

    public function safetyStock(Request $request, int $id)
    {
        $org = Organization::findOrFail($request->header('X-Organization-Id'));
        $role = $org->users()->where('users.id', $request->user()->id)->first()?->pivot->role;
        abort_unless(in_array($role, ['owner', 'admin'], true), 403);
        $data = $request->validate(['safety_stock' => 'required|integer|min:0|max:100000']);
        $store = Store::where('organization_id', $org->id)->findOrFail($id);
        abort_if($store->is_master, 422, 'Safety stock applies to downstream channels, not the authoritative master.');
        abort_unless(Store::where('organization_id', $org->id)->where('is_master', true)->exists(), 422, 'Choose a master store before configuring channel safety stock.');
        $store->update($data);

        return response()->json(['safety_stock' => $store->safety_stock, 'message' => 'Saved. Applies to subsequent stock pushes.']);
    }

    public function syncAll(Request $request)
    {
        $organizationId = $request->header('X-Organization-Id');
        $stores = Store::where('organization_id', $organizationId)->get();

        foreach ($stores as $store) {
            $this->queueSync($store);
        }

        return response()->json(['message' => 'Syncing started for '.$stores->count().' stores']);
    }

    public function destroy(Request $request, $id)
    {
        $organizationId = $request->header('X-Organization-Id');
        $store = Store::where('organization_id', $organizationId)->findOrFail($id);

        $store->delete(); // Integration will cascade if defined in migration, or handle manually

        return response()->json(['message' => 'Store disconnected']);
    }

    private function queueSync(Store $store): void
    {
        Cache::lock('store-sync-'.$store->id, 10)->block(3, function () use ($store) {
            $pending = SyncLog::where('store_id', $store->id)->whereIn('status', ['queued', 'in_progress'])
                ->where('updated_at', '>', now()->subMinutes(30))->exists();
            if ($pending) {
                return;
            }
            $store->update(['status' => 'syncing']);
            foreach (['orders', 'products'] as $type) {
                $log = SyncLog::create(['store_id' => $store->id, 'type' => $type, 'status' => 'queued']);
                try {
                    if ($type === 'orders') {
                        SyncOrdersJob::dispatch($store, null, $log->id);
                    } else {
                        SyncProductsJob::dispatch($store, $log->id);
                    }
                } catch (\Throwable $e) {
                    $log->update(['status' => 'failed']);
                    throw $e;
                }
            }
        });
    }
}
