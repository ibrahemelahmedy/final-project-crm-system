<?php

namespace Database\Factories;

use App\Models\CsatSurvey;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CsatSurvey>
 */
class CsatSurveyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'ticket_id' => Ticket::factory(),
            'resolution_cycle' => 1,
            'resolved_by' => User::factory(),
            'resolved_at' => now()->subDays(2),
            'rating' => null,
            'comment' => null,
            'responded_at' => null,
            'expires_at' => now()->addDays(28),
        ];
    }

    public function answered(int $rating = 4, ?string $comment = 'The agent was helpful and quick to respond.'): static
    {
        return $this->state(fn () => [
            'rating' => $rating,
            'comment' => $comment,
            'responded_at' => now()->subDay(),
        ]);
    }

    public function expired(): static
    {
        return $this->state(fn () => [
            'expires_at' => now()->subDay(),
        ]);
    }
}
