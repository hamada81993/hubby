<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A merchant asking for an integration that is not built yet. */
class IntegrationRequest extends Model
{
    protected $fillable = [
        'organization_id',
        'user_id',
        'integration',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
