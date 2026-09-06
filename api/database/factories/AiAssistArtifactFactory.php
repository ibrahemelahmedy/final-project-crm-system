<?php

namespace Database\Factories;

use App\Enums\AssistKind;
use App\Models\AiAssistArtifact;
use App\Models\Ticket;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AiAssistArtifact>
 */
class AiAssistArtifactFactory extends Factory
{
    public function definition(): array
    {
        return [
            'ticket_id' => Ticket::factory(),
            'kind' => AssistKind::Summary->value,
            'content' => fake()->paragraph(),
            'model' => 'claude-opus-5',
            'locale' => 'en',
            'generated_by' => null,
            'source_message_id' => null,
            'input_tokens' => 0,
            'output_tokens' => 0,
            'dismissed_at' => null,
        ];
    }

    public function summary(): static
    {
        return $this->state(fn () => ['kind' => AssistKind::Summary->value]);
    }

    public function suggestedReply(): static
    {
        return $this->state(fn () => ['kind' => AssistKind::SuggestedReply->value]);
    }

    public function dismissed(): static
    {
        return $this->state(fn () => ['dismissed_at' => now()]);
    }
}
