<?php

namespace App\Enums;

enum MessageVisibility: string
{
    case Public = 'public';
    case Internal = 'internal';

    public function label(): string
    {
        return match ($this) {
            self::Public => 'Reply to customer',
            self::Internal => 'Internal note',
        };
    }
}
