<?php

namespace App\Models;

use Database\Factories\KbCategoryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class KbCategory extends Model
{
    /** @use HasFactory<KbCategoryFactory> */
    use HasFactory;

    protected $fillable = ['name', 'slug', 'position'];

    public function articles(): HasMany
    {
        return $this->hasMany(KbArticle::class);
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
