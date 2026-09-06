<?php

namespace App\Http;

use App\Models\Customer;
use App\Models\PortalSession;
use Illuminate\Http\Request;

/**
 * Story 17 (WIS-16, Customer Portal). The single place a controller reaches
 * for the portal identity PortalAuth bound onto the request. Keeps the
 * "portal identity" concept in one file instead of $request->attributes
 * calls scattered across controllers.
 */
final class PortalRequest
{
    public static function customer(Request $request): Customer
    {
        $customer = $request->attributes->get('portal_customer');

        abort_unless($customer instanceof Customer, 401);

        return $customer;
    }

    public static function session(Request $request): PortalSession
    {
        $session = $request->attributes->get('portal_session');

        abort_unless($session instanceof PortalSession, 401);

        return $session;
    }
}
