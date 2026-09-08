<?php

namespace App\Mail;

use App\Mail\Concerns\BrandsMail;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Story 17 (WIS-16, Customer Portal). The one OTP delivery email. Rendered
 * in the recipient's locale — SetLocale has already resolved App::getLocale()
 * from the request's Accept-Language before this mailable is built.
 *
 * Story 23 (WIS-27) moved the body onto the shared `mail.layout` and left the
 * class name and the `public readonly string $code` constructor untouched —
 * both are asserted by PortalAccessRequestTest.
 */
class PortalAccessCodeMail extends Mailable
{
    use BrandsMail;
    use Queueable;
    use SerializesModels;

    public function __construct(public readonly string $code) {}

    public function build(): self
    {
        return $this->subject(__('portal.mail.subject'))
            ->view('mail.portal-access-code', [
                'code' => $this->code,
                ...$this->brandingViewData(),
            ]);
    }
}
