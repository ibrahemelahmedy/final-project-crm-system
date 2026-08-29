<?php

namespace App\Enums;

/**
 * Knowledge Base article lifecycle (Story 09). OWNED HERE.
 *
 * Later stories READ these values and never redefine them — a second copy of
 * the string 'published' anywhere else is how a status filter silently stops
 * matching after a rename.
 */
enum ArticleStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Archived = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Published => 'Published',
            self::Archived => 'Archived',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(fn (self $c) => $c->value, self::cases());
    }
}
