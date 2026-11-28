<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A named set of prices. A store that sells from one uses its prices instead of the product's. */
class PriceList extends Model
{
    protected $fillable = ['organization_id', 'name', 'currency', 'source_store_id', 'external_id'];

    public function items(): HasMany
    {
        return $this->hasMany(PriceListItem::class);
    }

    public function stores(): HasMany
    {
        return $this->hasMany(Store::class);
    }
}
