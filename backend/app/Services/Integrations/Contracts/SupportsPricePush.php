<?php

namespace App\Services\Integrations\Contracts;

use App\Models\Store;

/** A channel whose selling price can be set over its API. */
interface SupportsPricePush
{
    public function updatePrice(Store $store, string $sku, float $price): bool;
}
