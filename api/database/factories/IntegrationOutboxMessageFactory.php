<?php

namespace Database\Factories;

use App\Enums\IntegrationEvent;
use App\Enums\OutboxStatus;
use App\Models\Integration;
use App\Models\IntegrationOutboxMessage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<IntegrationOutboxMessage>
 *
 * Story 25 (WIS-24). Defaults to a pending ticket.resolved message.
 */
class IntegrationOutboxMessageFactory extends Factory
{
    protected $model = IntegrationOutboxMessage::class;

    public function definition(): array
    {
        return [
            'integration_id' => Integration::factory(),
            'event' => IntegrationEvent::TicketResolved->value,
            'event_id' => 'ticket.resolved:'.$this->faker->unique()->numberBetween(1, 100000).':1',
            'payload' => [
                'event' => IntegrationEvent::TicketResolved->value,
                'event_id' => 'ticket.resolved:1:1',
                'occurred_at' => now()->toJSON(),
                'data' => ['id' => 1, 'subject' => 'Test ticket'],
            ],
            'status' => OutboxStatus::Pending->value,
            'attempts' => 0,
            'next_attempt_at' => null,
        ];
    }

    public function delivered(): static
    {
        return $this->state(fn () => [
            'status' => OutboxStatus::Delivered->value,
            'attempts' => 1,
            'last_status' => 200,
            'delivered_at' => now(),
        ]);
    }

    public function dead(): static
    {
        return $this->state(fn () => [
            'status' => OutboxStatus::Dead->value,
            'attempts' => 5,
            'last_status' => 500,
            'last_error_key' => 'integrations.sync.error.max_attempts',
            'failed_at' => now(),
        ]);
    }

    public function due(): static
    {
        return $this->state(fn () => [
            'next_attempt_at' => now()->subMinute(),
        ]);
    }

    public function notDue(): static
    {
        return $this->state(fn () => [
            'next_attempt_at' => now()->addHour(),
        ]);
    }
}
