<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\PortalRequest;
use App\Services\PortalAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PortalSessionController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $customer = PortalRequest::customer($request);
        $session = PortalRequest::session($request);

        return response()->json([
            'id' => $customer->id,
            'name' => $customer->name,
            'masked_identifier' => PortalAccess::mask($customer->email ?? (string) $customer->phone),
            'expires_at' => $session->expires_at,
        ]);
    }

    public function destroy(Request $request): Response
    {
        PortalRequest::session($request)->forceFill(['revoked_at' => now()])->save();

        return response()->noContent();
    }
}
