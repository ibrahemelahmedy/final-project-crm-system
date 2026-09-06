<?php

namespace App\Http\Controllers;

use App\Http\Resources\BrandingResource;
use App\Services\OrganizationBranding;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Story 20 (WIS-20). Read-only, every ACTIVE authenticated user — the SPA
 * reads this on boot to apply the brand override. Admin-gating it would
 * leave every agent on the default palette; managing branding stays
 * administrator-only via Admin\BrandingController.
 */
class OrganizationBrandingController extends Controller
{
    public function __invoke(Request $request, OrganizationBranding $branding): JsonResponse
    {
        return response()->json(['data' => new BrandingResource($branding->current())]);
    }
}
