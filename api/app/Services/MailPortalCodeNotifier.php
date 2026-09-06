<?php

namespace App\Services;

use App\Mail\PortalAccessCodeMail;
use App\Models\Customer;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Story 17 (WIS-16, Customer Portal). The shipped PortalCodeNotifier
 * implementation — mail only, per Decision 4. `customers.email` is nullable,
 * so a phone-only customer never receives a code; that is a known, recorded
 * gap (ADR-005), not a bug to be papered over with a fake SMS success.
 */
class MailPortalCodeNotifier implements PortalCodeNotifier
{
    public function send(Customer $customer, string $code, string $identifier): void
    {
        if ($customer->email === null) {
            Log::warning('Portal OTP requested for a customer with no email on file; no delivery channel available.', [
                'customer_id' => $customer->id,
            ]);

            return;
        }

        Mail::to($customer->email)->send(new PortalAccessCodeMail($code));
    }
}
