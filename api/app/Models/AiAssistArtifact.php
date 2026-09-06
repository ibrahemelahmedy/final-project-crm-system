<?php

namespace App\Models;

use App\Enums\AssistKind;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Story 19 (WIS-18). One row per (ticket_id, kind); `TicketAssist::generate()`
 * is the ONLY writer, via `updateOrCreate` on the unique index.
 */
class AiAssistArtifact extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_id', 'kind', 'content', 'model', 'locale', 'generated_by',
        'source_message_id', 'input_tokens', 'output_tokens', 'dismissed_at',
    ];

    protected function casts(): array
    {
        return [
            'kind' => AssistKind::class,
            'dismissed_at' => 'datetime',
            'input_tokens' => 'integer',
            'output_tokens' => 'integer',
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }
}
