<?php

namespace App\Enums;

enum MessageVisibility: string
{
    case Public = 'public';
    case Internal = 'internal';

    public function label(): string
    {
        return __('enums.message_visibility.'.$this->value);
    }
}
