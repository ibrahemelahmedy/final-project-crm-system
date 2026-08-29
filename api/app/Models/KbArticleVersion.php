<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KbArticleVersion extends Model
{
    /** Snapshot rows are append-only; there is no updated_at to maintain. */
    public const UPDATED_AT = null;

    protected $fillable = ['kb_article_id', 'title', 'body', 'edited_by'];

    public function article(): BelongsTo
    {
        return $this->belongsTo(KbArticle::class, 'kb_article_id');
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'edited_by');
    }
}
