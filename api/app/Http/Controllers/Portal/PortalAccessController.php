<?php

namespace App\Http\Controllers\Portal;

use App\Exceptions\PortalCodeUnusableException;
use App\Http\Controllers\Controller;
use App\Http\Requests\PortalAccessRequest;
use App\Http\Requests\PortalVerifyRequest;
use App\Services\PortalAccess;
use Illuminate\Http\JsonResponse;

/**
 * Story 17 (WIS-16, Customer Portal). Public — no session. See
 * App\Services\PortalAccess for the state machine; this controller only
 * shapes the two responses.
 */
class PortalAccessController extends Controller
{
    public function __construct(private PortalAccess $access) {}

    public function request(PortalAccessRequest $request): JsonResponse
    {
        $identifier = $request->validated('identifier');

        $this->access->requestCode($identifier, $request->ip());

        // Always 202, always this body, matched or not — an identifier must
        // never be enumerable. `masked_identifier` is derived from the typed
        // value, never from a database row.
        return response()->json([
            'sent' => true,
            'masked_identifier' => PortalAccess::mask($identifier),
            'resend_after_seconds' => PortalAccess::RESEND_COOLDOWN_SECONDS,
        ], 202);
    }

    public function verify(PortalVerifyRequest $request): JsonResponse
    {
        $identifier = $request->validated('identifier');

        try {
            $session = $this->access->verify($identifier, $request->validated('code'), $request->userAgent());
        } catch (PortalCodeUnusableException $e) {
            return $e->render($request);
        }

        if ($session === null) {
            return response()->json([
                'message' => __('portal.code_invalid'),
                'attempts_remaining' => $this->access->attemptsRemaining($identifier),
            ], 422);
        }

        $customer = $session->customer;

        return response()->json([
            'token' => $session->getAttribute('plaintext_token'),
            'expires_at' => $session->expires_at,
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'masked_identifier' => PortalAccess::mask($identifier),
            ],
        ]);
    }
}
