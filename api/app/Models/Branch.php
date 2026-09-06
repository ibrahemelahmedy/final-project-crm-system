<?php

namespace App\Models;

use Database\Factories\BranchFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Story 20 (WIS-20). An organisational location, not a tenant. */
class Branch extends Model
{
    /** @use HasFactory<BranchFactory> */
    use HasFactory;

    protected $fillable = ['name', 'region', 'timezone', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
