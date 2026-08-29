<?php

namespace Database\Factories;

use App\Enums\QuickReplyStatus;
use App\Models\QuickReply;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<QuickReply>
 */
class QuickReplyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title' => fake()->sentence(4),
            'body' => 'Hi {{customer.first_name}}, thanks for reaching out about ticket {{ticket.id}}.',
            'category' => fake()->randomElement(['billing', 'account', 'general']),
            'status' => QuickReplyStatus::Active->value,
            'created_by' => User::factory(),
            'updated_by' => null,
        ];
    }

    public function archived(): static
    {
        return $this->state(fn () => ['status' => QuickReplyStatus::Archived->value]);
    }
}
