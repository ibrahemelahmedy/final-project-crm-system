<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;


class AuditLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'event',
        'email',
        'ip_address',
        'user_agent',
        'context',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'context' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public static function record(string $event, ?User $user, Request $request, array $context = []): void
    {
        // Safety check: ensure password or credential fields are never captured in audit log context
        unset($context['password'], $context['password_confirmation']);

        static::create([
            'user_id' => $user?->id,
            'event' => $event,
            'email' => $user?->email ?? Str::lower((string) $request->input('email')),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'context' => !empty($context) ? $context : null,
            'created_at' => now(),
        ]);
    }
}
