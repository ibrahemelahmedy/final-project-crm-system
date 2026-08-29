<?php

namespace Database\Factories;

use App\Enums\NotificationType;
use App\Models\Notification;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Notification>
 */
class NotificationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $ticket = Ticket::factory()->create();

        return [
            'user_id' => User::factory(),
            'type' => fake()->randomElement(NotificationType::cases())->value,
            'title' => fake()->sentence(8),
            'body' => fake()->sentence(12),
            'source_type' => $ticket->getMorphClass(),
            'source_id' => $ticket->id,
            'link_to' => "/tickets/{$ticket->id}",
            'read_at' => null,
        ];
    }

    public function read(): static
    {
        return $this->state(fn (array $attributes) => [
            'read_at' => now(),
        ]);
    }

    public function withoutSource(): static
    {
        return $this->state(fn (array $attributes) => [
            'source_type' => null,
            'source_id' => null,
            'link_to' => null,
        ]);
    }
}
