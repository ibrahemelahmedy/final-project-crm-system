<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthenticatedSessionController extends Controller
{
    private const DUMMY_HASH = '$2y$12$15oJ8J8D.p386Z5Y2R88/uK/101y0X.u0.9999999999999999999';

    public function store(LoginRequest $request): JsonResponse
    {
        $email = Str::lower($request->email);
        $user = User::where('email', $email)->first();

        // Constant-work path: hash a dummy value when no user matched, so response
        // timing does not distinguish "unknown email" from "wrong password".
        $passwordOk = $user
            ? Hash::check($request->password, $user->password)
            : Hash::check($request->password, self::DUMMY_HASH);

        if (! $passwordOk) {
            AuditLog::record('login.failed', $user, $request);
            throw ValidationException::withMessages([
                'email' => [trans('auth.failed')],
            ]);
        }

        // Reached ONLY after the password is verified. Revealing deactivation here
        // tells an attacker nothing they have not already proven they know, so the
        // clear message the story asks for costs no enumeration. Do NOT move this
        // check above the password check.
        if (! $user->is_active) {
            AuditLog::record('login.inactive', $user, $request);
            throw ValidationException::withMessages([
                'email' => ['This account has been deactivated. Contact your administrator.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken('spa')->plainTextToken;
        AuditLog::record('login.success', $user, $request);

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
        ]);
    }

    public function destroy(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();
        AuditLog::record('logout', $request->user(), $request);

        return response()->noContent();
    }
}
