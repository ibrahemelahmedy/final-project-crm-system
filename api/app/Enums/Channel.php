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
        return match ($this) {
            self::Email => 'Email',
            self::Whatsapp => 'WhatsApp',
            self::Chat => 'Live chat',
            self::Sms => 'SMS',
            self::WebForm => 'Web form',
        };
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
