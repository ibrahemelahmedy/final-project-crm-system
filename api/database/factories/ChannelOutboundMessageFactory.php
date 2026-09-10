<?php

namespace Database\Factories;

use App\Enums\ChannelDeliveryStatus;
use App\Models\ChannelConnection;
use App\Models\ChannelOutboundMessage;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ChannelOutboundMessage> */
class ChannelOutboundMessageFactory extends Factory
{
    protected $model = ChannelOutboundMessage::class;

    public function definition(): array
    {
        return [
            'channel_connection_id' => ChannelConnection::factory(),
            'ticket_id' => Ticket::factory(),
            'ticket_message_id' => TicketMessage::factory(),
            'recipient' => fake()->safeEmail(),
            'body' => fake()->sentence(),
            'provider_message_id' => null,
            'in_reply_to' => null,
            'status' => ChannelDeliveryStatus::Pending->value,
            'attempts' => 0,
            'next_attempt_at' => null,
            'last_status' => null,
            'last_error_key' => null,
            'delivered_at' => null,
            'failed_at' => null,
        ];
    }

    public function dead(): static
    {
        return $this->state(fn () => [
            'status' => ChannelDeliveryStatus::Dead->value,
            'failed_at' => now(),
            'last_error_key' => 'channels.error.max_attempts',
        ]);
    }
}
