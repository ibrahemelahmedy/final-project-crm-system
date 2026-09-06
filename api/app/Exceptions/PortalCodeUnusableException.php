<?php

namespace App\Exceptions;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

/**
 * Story 17 (WIS-16, Customer Portal). Thrown when the newest access code for
 * an identifier is missing, consumed, expired, or attempt-exhausted. Renders
 * the same 410 body for all four causes — the SPA maps it to the
 * "Step2 Error Expired" artboard.
 */
class PortalCodeUnusableException extends \RuntimeException
{
    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => __('portal.code_expired'),
            'attempts_remaining' => 0,
        ], 410);
    }
}
