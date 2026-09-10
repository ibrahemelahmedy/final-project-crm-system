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

    /**
     * Story 26 (WIS-22). Channels a provider can be connected to.
     * `web_form` never can — it is the portal form, not a provider.
     * Derived by exclusion, so a sixth enum case is not silently connectable.
     *
     * @return array<int, self>
     */
    public static function connectable(): array
    {
        return array_values(array_filter(self::cases(), fn (self $c) => $c !== self::WebForm));
    }

    /**
     * Story 26 (WIS-22). Channels an agent reply can be delivered OUT over.
     * `chat` is polled (no outbound send); `web_form` has no return path.
     *
     * @return array<int, self>
     */
    public static function deliverable(): array
    {
        return array_values(array_filter(
            self::cases(),
            fn (self $c) => $c !== self::WebForm && $c !== self::Chat
        ));
    }
}
