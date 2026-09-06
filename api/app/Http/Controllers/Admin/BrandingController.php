<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveBrandingRequest;
use App\Http\Requests\UploadBrandingLogoRequest;
use App\Http\Resources\BrandingResource;
use App\Models\User;
use App\Services\AuditTrail;
use App\Services\OrganizationBranding;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/** Story 20 (WIS-20). Reuses UserPolicy@manageSettings — no new ability. */
class BrandingController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly OrganizationBranding $branding,
        private readonly AuditTrail $audit,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $this->authorize('manageSettings', User::class);

        return response()->json(['data' => new BrandingResource($this->branding->current())]);
    }

    public function update(SaveBrandingRequest $request): JsonResponse
    {
        $this->authorize('manageSettings', User::class);

        $this->branding->setPrimaryColor(
            $request->validated()['primary_color'],
            $request->user(),
            $request,
            $this->audit,
        );

        return response()->json(['data' => new BrandingResource($this->branding->current())]);
    }

    public function uploadLogo(UploadBrandingLogoRequest $request): JsonResponse
    {
        $this->authorize('manageSettings', User::class);

        $disk = config('branding.disk');
        $previous = $this->branding->current()['logo_path'];

        // Laravel generates the random filename; the client's filename is
        // never used as the on-disk path.
        $path = $request->file('logo')->store('branding', $disk);

        $this->branding->setLogoPath($path, $request->user(), $request, $this->audit);

        if ($previous !== null) {
            Storage::disk($disk)->delete($previous);
        }

        return response()->json(['data' => new BrandingResource($this->branding->current())]);
    }

    public function destroyLogo(Request $request): JsonResponse
    {
        $this->authorize('manageSettings', User::class);

        $disk = config('branding.disk');
        $previous = $this->branding->current()['logo_path'];

        if ($previous !== null) {
            // Storage::delete tolerates a missing file — it returns false,
            // it does not throw.
            Storage::disk($disk)->delete($previous);
        }

        $this->branding->setLogoPath(null, $request->user(), $request, $this->audit);

        return response()->json(['data' => new BrandingResource($this->branding->current())]);
    }
}
