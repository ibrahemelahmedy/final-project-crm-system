<?php

namespace Database\Factories;

use App\Models\ChannelConnection;
use App\Models\ChatSession;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<ChatSession> */
class ChatSessionFactory extends Factory
{
    protected $model = ChatSession::class;

    public function definition(): array
    {
        return [
            'channel_connection_id' => ChannelConnection::factory()->chat(),
            'token_hash' => ChatSession::hashToken(Str::random(40)),
            'customer_id' => null,
            'ticket_id' => null,
            'visitor_name' => null,
            'visitor_email' => null,
            'origin' => 'https://example.com',
            'message_count' => 0,
            'last_seen_message_id' => null,
            'expires_at' => now()->addHours(4),
            'last_used_at' => null,
            'revoked_at' => null,
            'user_agent' => 'PestTestAgent/1.0',
        ];
    }

    /** Sets a known plaintext so a test can send it as a bearer token. */
    public function withToken(string $plaintext): static
    {
        return $this->state(fn () => ['token_hash' => ChatSession::hashToken($plaintext)]);
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
