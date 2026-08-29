<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * System configuration. One row per key; `value` is json so a setting can be
 * a scalar today and a structure later without a migration per key.
 *
 * The catalogue of valid keys lives in App\Services\SystemSettings — this
 * model is storage only and validates nothing.
 */
class Setting extends Model
{
    protected $fillable = ['key', 'value', 'updated_by'];

    protected function casts(): array
    {
        return [
            'value' => 'array',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
