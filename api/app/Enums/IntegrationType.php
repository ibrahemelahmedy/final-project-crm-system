<?php

namespace App\Enums;

/**
 * Story 18 (WIS-19). The five integration types an Administrator can configure.
 *
 * Deliberately NOT App\Enums\Channel: that enum is `email, whatsapp, chat, sms,
 * web_form` and is the origin recorded on tickets.channel. This one adds `erp`
 * and `api_webhook` and drops `chat` and `web_form`. Two overlapping sets, not
 * one set seen twice — see Decision 1 in the story plan.
 */
enum IntegrationType: string
{
    case Erp = 'erp';
    case Email = 'email';
    case Sms = 'sms';
    case Whatsapp = 'whatsapp';
    case ApiWebhook = 'api_webhook';

    /** The i18n key the SPA resolves for the card title. */
    public function labelKey(): string
    {
        return 'integrations.type.'.$this->value.'.label';
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(fn (self $t) => $t->value, self::cases());
    }
}
