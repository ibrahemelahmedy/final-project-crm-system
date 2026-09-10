<?php

namespace App\Enums;

/**
 * Story 26 (WIS-22). Deliberately NOT App\Enums\Channel and deliberately NOT
 * App\Enums\IntegrationType: it is a third overlapping set, keyed by WHO
 * SIGNS THE PAYLOAD, not by what the message is about or how it is
 * configured. One provider serves exactly one channel.
 */
enum ChannelProvider: string
{
    case EmailWebhook = 'email_webhook';
    case WhatsappCloud = 'whatsapp_cloud';
    case TwilioSms = 'twilio_sms';
    case WisalChat = 'wisal_chat';

    /** The Channel this provider can serve. One provider, one channel. */
    public function channel(): Channel
    {
        return match ($this) {
            self::EmailWebhook => Channel::Email,
            self::WhatsappCloud => Channel::Whatsapp,
            self::TwilioSms => Channel::Sms,
            self::WisalChat => Channel::Chat,
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(fn (self $p) => $p->value, self::cases());
    }
}
