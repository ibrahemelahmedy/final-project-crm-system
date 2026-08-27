<?php

namespace App\Enums;

use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Support\Facades\DB;

enum Priority: string
{
    case Low = 'low';
    case Normal = 'normal';
    case High = 'high';
    case Urgent = 'urgent';

    public function label(): string
    {
        return match ($this) {
            self::Low => 'Low',
            self::Normal => 'Normal',
            self::High => 'High',
            self::Urgent => 'Urgent',
        };
    }

    /** Ascending urgency. Used for sorting — never persisted. */
    public function weight(): int
    {
        return match ($this) {
            self::Low => 1,
            self::Normal => 2,
            self::High => 3,
            self::Urgent => 4,
        };
    }

    /**
     * Sorting on the raw string column orders alphabetically
     * (high, low, normal, urgent) — which is wrong in every direction.
     * Order by this expression instead.
     */
    public static function sortExpression(): Expression
    {
        return DB::raw(
            "CASE tickets.priority "
            ."WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 "
            ."WHEN 'normal' THEN 2 WHEN 'low' THEN 1 ELSE 0 END"
        );
    }

    /** @return array<int, array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(
            fn (self $c) => ['value' => $c->value, 'label' => $c->label()],
            self::cases()
        );
    }
}
