<?php

namespace App\Http\Middleware;

use App\Models\PortalSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Story 17 (WIS-16, Customer Portal). Resolves a portal bearer token to a
 * live PortalSession and binds the customer onto the request. Deliberately
 * NEVER calls Auth::login() or sets a user resolver — nothing in the
 * web/sanctum guard learns a customer exists. See PortalRequest for the
 * accessor controllers use.
 *
 * Every failure (missing, unknown, revoked, expired token) renders the same
 * 401 body, so an expired session is indistinguishable from a forged one.
 */
class PortalAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $plain = $request->bearerToken();

        if ($plain === null) {
            return $this->unauthorized();
        }

        $session = PortalSession::with('customer')
            ->where('token_hash', PortalSession::hashToken($plain))
            ->first();

        if ($session === null || ! $session->isLive() || $session->customer === null) {
            return $this->unauthorized();
        }

        // saveQuietly so the last-used bump never fires model events.
        $session->forceFill(['last_used_at' => now()])->saveQuietly();

        $request->attributes->set('portal_session', $session);
        $request->attributes->set('portal_customer', $session->customer);

        return $next($request);
    }

    private function unauthorized(): Response
    {
        return response()->json(['message' => __('portal.session_invalid')], 401);
    }
}
