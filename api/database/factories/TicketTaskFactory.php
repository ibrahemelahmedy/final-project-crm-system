<?php

namespace Database\Factories;

use App\Enums\TaskStatus;
use App\Models\Ticket;
use App\Models\TicketTask;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TicketTask>
 */
class TicketTaskFactory extends Factory
{
    public function definition(): array
    {
        return [
            'ticket_id' => Ticket::factory(),
            'title' => fake()->sentence(5),
            'due_at' => fake()->dateTimeBetween('now', '+3 days'),
            'assignee_id' => User::factory(),
            'created_by' => User::factory(),
            'status' => TaskStatus::Open->value,
        ];
    }

    public function overdue(): static
    {
        return $this->state(fn () => ['due_at' => now()->subDay()]);
    }

    public function completed(): static
    {
        return $this->state(fn (array $attrs) => [
            'status' => TaskStatus::Completed->value,
            'completed_at' => now(),
        ]);
    }
}
