<?php

namespace App\Http\Controllers;

use App\Jobs\PushInventoryJob;
use App\Models\Organization;
use App\Models\PlatformProduct;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Services\Inventory\StockAllocator;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StockAllocationController extends Controller
{
    /** The organisation's allocation mode and each sales channel's share. */
    public function show(Request $request)
    {
        $org = Organization::findOrFail($request->header('X-Organization-Id'));

        return response()->json($this->payload($org));
    }

    /** Change the mode and, for split mode, the percentage each channel gets. */
    public function update(Request $request)
    {
        $org = $this->managedOrganization($request);
        $data = $request->validate([
            'mode' => ['required', Rule::in(StockAllocator::MODES)],
            'basis' => ['sometimes', Rule::in(StockAllocator::BASES)],
            'allow_oversell' => 'sometimes|boolean',
            'percents' => 'sometimes|array',
            'percents.*' => 'nullable|integer|min:0|max:100',
            'units' => 'sometimes|array',
            'units.*' => 'nullable|integer|min:0|max:1000000',
        ]);

        $channels = $this->channels($org);
        $percents = collect($data['percents'] ?? [])->only($channels->pluck('id')->all());
        abort_if($percents->sum() > 100, 422, 'The shares add up to more than 100%.');
        abort_if(
            $data['mode'] === 'split' && $percents->isNotEmpty() && (int) $percents->sum() === 0,
            422,
            'Give at least one channel a share, or clear them all to split evenly.',
        );

        $units = collect($data['units'] ?? [])->only($channels->pluck('id')->all());

        $org->update(array_filter([
            'stock_allocation_mode' => $data['mode'],
            'stock_split_basis' => $data['basis'] ?? null,
            'allow_oversell' => $data['allow_oversell'] ?? null,
        ], fn ($value) => $value !== null));
        foreach ($channels as $channel) {
            $changes = [];
            if ($percents->has($channel->id)) {
                $changes['allocation_percent'] = $percents[$channel->id];
            }
            if ($units->has($channel->id)) {
                $changes['allocation_units'] = $units[$channel->id];
            }
            if ($changes) {
                $channel->update($changes);
            }
        }

        return response()->json($this->payload($org->fresh()) + ['message' => 'Saved. Applies to the next stock update of each product.']);
    }

    /** Manual mode: the quantity offered for one listing. Null goes back to the shared number. */
    public function setQuantity(Request $request, int $id)
    {
        $org = $this->managedOrganization($request);
        $data = $request->validate(['quantity' => 'present|nullable|integer|min:0|max:1000000']);

        $listing = PlatformProduct::whereHas('store', fn ($q) => $q->where('organization_id', $org->id))->findOrFail($id);
        $listing->update(['allocated_quantity' => $data['quantity']]);

        if ($org->stock_allocation_mode === 'manual' && ($variant = ProductVariant::find($listing->product_variant_id))) {
            PushInventoryJob::dispatch($variant);
        }

        return response()->json(['id' => $listing->id, 'allocated_quantity' => $listing->allocated_quantity]);
    }

    private function managedOrganization(Request $request): Organization
    {
        $org = Organization::findOrFail($request->header('X-Organization-Id'));
        $role = $org->users()->where('users.id', $request->user()->id)->first()?->pivot->role;
        abort_unless(in_array($role, ['owner', 'admin'], true), 403);

        return $org;
    }

    /** Sales channels only: the master and product sources are not given a share. */
    private function channels(Organization $org)
    {
        return Store::where('organization_id', $org->id)
            ->where('is_master', false)
            ->whereNotIn('platform', StockAllocator::SOURCES)
            ->orderBy('id')
            ->get();
    }

    private function payload(Organization $org): array
    {
        $channels = $this->channels($org);
        $allocator = app(StockAllocator::class);
        $connected = Store::where('organization_id', $org->id)->where('status', 'connected')->get();

        return [
            'mode' => $org->stock_allocation_mode ?? 'shared',
            'basis' => $org->stock_split_basis ?? 'percent',
            'allow_oversell' => (bool) $org->allow_oversell,
            'channels' => $channels->map(fn (Store $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'platform' => $s->platform,
                'allocation_percent' => $s->allocation_percent,
                'allocation_units' => $s->allocation_units,
                'safety_stock' => (int) $s->safety_stock,
                // What split mode gives this channel right now, including the even split.
                'effective_percent' => round($allocator->shareOf($s, $connected), 1),
            ])->values(),
        ];
    }
}
