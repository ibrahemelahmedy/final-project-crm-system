<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSettingsRequest;
use App\Models\User;
use App\Services\AuditTrail;
use App\Services\SystemSettings;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Thin. Validation lives in UpdateSettingsRequest (which reads its rules from
 * SystemSettings), persistence and the `setting.changed` audit row live in
 * SystemSettings::update().
 */
class SettingsController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly SystemSettings $settings,
        private readonly AuditTrail $audit,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorize('manageSettings', User::class);

        return response()->json(['data' => $this->settings->all()]);
    }

    public function update(UpdateSettingsRequest $request): JsonResponse
    {
        $this->authorize('manageSettings', User::class);

        $changed = $this->settings->update(
            $request->validated()['settings'],
            $request->user(),
            $request,
            $this->audit,
        );

        return response()->json([
            'data' => $this->settings->all(),
            'changed' => $changed,
        ]);
    }
}
