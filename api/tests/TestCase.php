<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Authenticate the next requests as the bearer of $token.
     *
     * The guard is forgotten first. Laravel reuses one application instance
     * for every request inside a single test, and the `sanctum` guard caches
     * the user it resolved on the first one — so simply swapping the
     * Authorization header keeps returning the FIRST user. Story 08's tests
     * switch identity mid-test constantly (deactivate as the Administrator,
     * then re-request as the victim), so this is not an edge case here.
     */
    protected function asToken(string $token): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', "Bearer {$token}");
    }

    /** Mint a token for $user and authenticate as its bearer. */
    protected function asUser(User $user): static
    {
        return $this->asToken($user->createToken('spa')->plainTextToken);
    }
}
