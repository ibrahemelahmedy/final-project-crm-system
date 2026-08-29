<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdatePreferencesRequest;
use App\Http\Resources\UserResource;

/**
 * Story 15 (WIS-11). The single writer of `users.locale`. Writes only the
 * authenticated caller's row and echoes back the updated UserResource, so the
 * SPA reconciles from the same shape every other screen already reads.
 */
class UserPreferencesController extends Controller
{
    public function update(UpdatePreferencesRequest $request): UserResource
    {
        $user = $request->user();
        $user->update(['locale' => $request->validated('locale')]);

        return new UserResource($user->fresh());
    }
}
