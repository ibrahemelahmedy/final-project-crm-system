<?php

namespace App\Models;

use App\Enums\TaskStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketTask extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_id', 'title', 'due_at', 'assignee_id', 'created_by',
        'status', 'completed_by', 'completed_at', 'cancel_reason', 'reminded_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => TaskStatus::class,
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
            'reminded_at' => 'datetime',
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function completer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    /** due_at IS NULL never matches — a task with no due date has due_state 'none'. */
    public function scopeDueForReminder(Builder $query)
    {
        return $query
            ->where('status', TaskStatus::Open)
            ->whereNotNull('due_at')
            ->where('due_at', '<=', now())
            ->whereNull('reminded_at');
    }
}
