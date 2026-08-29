<?php

namespace Database\Factories;

use App\Enums\Channel;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TicketMessage>
 */
class TicketMessageFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'ticket_id' => Ticket::factory(),
            'author_type' => TicketMessage::AUTHOR_CUSTOMER,
            'user_id' => null,
            'customer_id' => Customer::factory(),
            'channel' => Channel::Email->value,
            'body' => fake()->paragraph(),
        ];
    }

    public function fromAgent(User $agent): static
    {
        return $this->state(fn (array $attributes) => [
            'author_type' => TicketMessage::AUTHOR_AGENT,
            'user_id' => $agent->id,
            'customer_id' => null,
        ]);
    }

    public function overChannel(Channel $channel): static
    {
        return $this->state(fn (array $attributes) => [
            'channel' => $channel->value,
        ]);
    }
}
