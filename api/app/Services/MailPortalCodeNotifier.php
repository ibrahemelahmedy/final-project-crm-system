<?php

namespace App\Services;

use App\Mail\PortalAccessCodeMail;
use App\Models\Customer;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

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

        try {
            Mail::to($customer->email)->send(new PortalAccessCodeMail($code));
        } catch (Throwable $e) {
            // Story 23 (WIS-27), Decision 7. The code row is already committed
            // (PortalAccess::requestCode sends AFTER the transaction,
            // deliberately). Letting an SMTP 550 escape would 500 the request
            // for identifiers that matched a real customer and 202 for those
            // that did not — an enumeration oracle. Log and swallow.
            // NEVER log $code.
            Log::error('Portal access code email failed to send.', [
                'customer_id' => $customer->id,
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);
        }
    }
}
