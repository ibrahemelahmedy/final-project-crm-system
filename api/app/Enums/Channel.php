<?php

namespace App\Enums;

enum Channel: string
{
    case Email = 'email';
    case Whatsapp = 'whatsapp';
    case Chat = 'chat';
    case Sms = 'sms';
    case WebForm = 'web_form';

    public function label(): string
    {
        return __('enums.channel.'.$this->value);
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
