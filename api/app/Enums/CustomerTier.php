<?php

namespace App\Enums;

enum CustomerTier: string
{
    case Standard = 'standard';
    case Premium = 'premium';
    case Enterprise = 'enterprise';

    public function label(): string
    {
        return __('enums.customer_tier.'.$this->value);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
