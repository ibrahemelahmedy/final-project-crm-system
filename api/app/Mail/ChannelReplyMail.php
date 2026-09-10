<?php

namespace App\Mail;

use App\Mail\Concerns\BrandsMail;
use App\Models\ChannelOutboundMessage;
use App\Services\CustomerLocale;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

/**
 * Story 26 (WIS-22), Decision 9. An agent's public reply, delivered over
 * WIS-27's mailer. Sets an explicit Message-ID (recorded by MailChannelSender
 * into channel_outbound_messages.provider_message_id) and an In-Reply-To
 * pointing at the inbound message it answers, so Decision 6's email
 * threading works on the customer's next reply.
 *
 * Locale is set in the CONSTRUCTOR, not build() — Mailable::render()/send()
 * already wrap build() in withLocale(), the correction WIS-27 recorded.
 * Story 28 (WIS-29) Decision 6: CustomerLocale::forTicket() renders `ar` when
 * the ticket's own text is Arabic, otherwise config('mail.customer_locale').
 *
 * Not `implements ShouldQueue` — there is no queue worker in this repository.
 */
final class ChannelReplyMail extends Mailable
{
    use BrandsMail;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly ChannelOutboundMessage $outboundMessage,
        public readonly string $generatedMessageId,
    ) {
        $this->locale(CustomerLocale::forTicket($outboundMessage->ticket));
    }

    public function build(): self
    {
        $ticket = $this->outboundMessage->ticket;
        $subject = Str::limit((string) $ticket?->subject, 60, '');

        $this->withSymfonyMessage(function ($message) {
            $message->getHeaders()->addIdHeader('Message-ID', $this->generatedMessageId);

            if ($this->outboundMessage->in_reply_to !== null) {
                $ref = '<'.$this->outboundMessage->in_reply_to.'>';
                $message->getHeaders()->addTextHeader('In-Reply-To', $ref);
                $message->getHeaders()->addTextHeader('References', $ref);
            }
        });

        return $this->subject(__('channels.mail.reply_subject', ['subject' => $subject]))
            ->view('mail.channel-reply', [
                'body' => $this->outboundMessage->body,
                'ticketSubject' => (string) $ticket?->subject,
                ...$this->brandingViewData(),
            ]);
    }
}
