<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Story 17 (WIS-16, Customer Portal). The one OTP delivery email. Rendered
 * in the recipient's locale — SetLocale has already resolved App::getLocale()
 * from the request's Accept-Language before this mailable is built.
 */
class PortalAccessCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly string $code) {}

    public function build(): self
    {
        return $this->subject(__('portal.mail.subject'))
            ->view('mail.portal-access-code');
    }
}
