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

    /**
     * Resolved through the translator so `priority_label` arrives in the
     * caller's language — SetLocale reads the SPA's Accept-Language on every
     * request. The English catalogue returns the same strings this method
     * previously hard-coded, so every existing consumer is unaffected.
     */
    public function label(): string
    {
        return __('enums.priority.'.$this->value);
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
    /**
     * The ONE priority weight map. `sla_rules` orders its four cards by the
     * same expression the ticket queue sorts by, which is why the column is a
     * parameter rather than a second copy of the CASE — Story 06.
     *
     * The column name is never client-supplied; both call sites pass a literal.
     */
    public static function sortExpression(string $column = 'tickets.priority'): Expression
    {
        return DB::raw(
            "CASE {$column} "
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
