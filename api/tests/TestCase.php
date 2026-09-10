<?php

namespace Tests;

use App\Models\User;
use App\Observers\TicketClassificationObserver;
use App\Observers\TicketResolutionObserver;
use App\Services\Channels\ChannelOutbox;
use App\Services\Integrations\IntegrationEvents;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Story 23 (WIS-27). The observer's per-request CSAT-invitation cap
        // counter is a process static; reset it so one test's resolves never
        // count against the next test's cap.
        TicketResolutionObserver::resetInvitationCounter();

        // Story 24 (WIS-23). Same rationale — the classification observer's
        // per-request cap counter is a process static.
        TicketClassificationObserver::resetClassificationCounter();

        // Story 25 (WIS-24). Same rationale — the inline-delivery cap is a process static.
        IntegrationEvents::resetInlineCounter();

        // Story 26 (WIS-22). Same rationale — the inline-delivery cap is a process static.
        ChannelOutbox::resetInlineCounter();
    }

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
