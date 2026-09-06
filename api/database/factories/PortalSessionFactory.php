<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\PortalSession;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PortalSession>
 */
class PortalSessionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'customer_id' => Customer::factory(),
            'token_hash' => PortalSession::hashToken(Str::random(64)),
            'expires_at' => now()->addHours(24),
            'last_used_at' => null,
            'revoked_at' => null,
            'user_agent' => 'PestTestAgent/1.0',
        ];
    }

    /** Sets a known plaintext so a test can send it as a bearer token. */
    public function withToken(string $plaintext): static
    {
        return $this->state(fn () => ['token_hash' => PortalSession::hashToken($plaintext)]);
    }

    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subMinute()]);
    }

    public function revoked(): static
    {
        return $this->state(fn () => ['revoked_at' => now()]);
    }
}
