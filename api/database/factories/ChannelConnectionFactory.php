<?php

namespace Database\Factories;

use App\Enums\Channel;
use App\Enums\ChannelConnectionStatus;
use App\Enums\ChannelProvider;
use App\Models\ChannelConnection;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ChannelConnection>
 *
 * Story 26 (WIS-22). Defaults to a connected `whatsapp` row. There is no
 * seeder entry for this model (Task 59) — a seeded connection would show a
 * fabricated CONNECTED card on a fresh install.
 */
class ChannelConnectionFactory extends Factory
{
    protected $model = ChannelConnection::class;

    public function definition(): array
    {
        $secret = 'test-secret-'.Str::random(24);

        return [
            'channel' => Channel::Whatsapp->value,
            'provider' => ChannelProvider::WhatsappCloud->value,
            'secret' => $secret,
            'secret_last_four' => substr($secret, -4),
            'verify_token' => Str::random(16),
            'config' => ['phone_number_id' => '1234567890'],
            'status' => ChannelConnectionStatus::Connected->value,
            'last_inbound_at' => null,
            'last_outbound_at' => null,
            'last_error_key' => null,
            'last_error_at' => null,
            'connected_by' => User::factory(),
        ];
    }

    public function whatsapp(): static
    {
        return $this->state(fn () => [
            'channel' => Channel::Whatsapp->value,
            'provider' => ChannelProvider::WhatsappCloud->value,
            'config' => ['phone_number_id' => '1234567890'],
        ]);
    }

    public function sms(): static
    {
        return $this->state(fn () => [
            'channel' => Channel::Sms->value,
            'provider' => ChannelProvider::TwilioSms->value,
            'config' => ['account_sid' => 'AC'.Str::random(32), 'from_number' => '+15005550006'],
        ]);
    }

    public function email(): static
    {
        return $this->state(fn () => [
            'channel' => Channel::Email->value,
            'provider' => ChannelProvider::EmailWebhook->value,
            'config' => ['inbound_address' => 'support@example.com'],
        ]);
    }

    public function chat(): static
    {
        return $this->state(fn () => [
            'channel' => Channel::Chat->value,
            'provider' => ChannelProvider::WisalChat->value,
            'config' => ['site_key' => Str::random(24), 'allowed_origins' => ['https://example.com']],
        ]);
    }

    public function errored(): static
    {
        return $this->state(fn () => [
            'status' => ChannelConnectionStatus::Error->value,
            'last_error_key' => 'channels.error.not_configured',
            'last_error_at' => now(),
        ]);
    }
}
