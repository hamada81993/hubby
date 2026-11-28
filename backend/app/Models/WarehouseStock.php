<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** How many units of a variant sit in one warehouse. */
class WarehouseStock extends Model
{
    protected $table = 'warehouse_stock';

    protected $fillable = ['organization_id', 'warehouse_id', 'product_variant_id', 'quantity'];

    protected $casts = ['quantity' => 'integer'];

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}
