<?php

namespace App\Services;

use App\Models\Customer;

/**
 * Story 17 (WIS-16, Customer Portal). The OTP delivery seam — Decision 4 in
 * the story plan. Category 11 (Integrations: Email, SMS & WhatsApp) is out
 * of scope, so this ships with exactly one implementation
 * (MailPortalCodeNotifier). A real SMS/WhatsApp driver is a later story
 * behind the same interface.
 */
interface PortalCodeNotifier
{
    public function send(Customer $customer, string $code, string $identifier): void;
}
