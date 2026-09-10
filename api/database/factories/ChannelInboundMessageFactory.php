<?php

namespace Database\Factories;

use App\Models\ChannelConnection;
use App\Models\ChannelInboundMessage;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<ChannelInboundMessage> */
class ChannelInboundMessageFactory extends Factory
{
    protected $model = ChannelInboundMessage::class;

    public function definition(): array
    {
        return [
            'channel_connection_id' => ChannelConnection::factory(),
            'provider_message_id' => 'msg-'.Str::random(16),
            'external_thread_ref' => null,
            'ticket_id' => null,
            'ticket_message_id' => null,
            'customer_id' => null,
            'outcome' => 'created',
            'received_at' => now(),
        ];
    }
}
