<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Ticket extends Model
{
    use HasFactory;

    protected $fillable = [
        'subject',
        'status',
        'priority',
        'assigned_to',
    ];

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        // Shortcut: team queue expands to all tickets until teams table lands in Ticket Management story
        return $user->canSeeTeamQueue()
            ? $query
            : $query->where('assigned_to', $user->id);
    }
}
