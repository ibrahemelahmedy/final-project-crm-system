<?php

namespace Database\Factories;

use App\Enums\Channel;
use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Ticket>
 */
class TicketFactory extends Factory
{
    /** Realistic subjects for FACTORY tickets (tests). The seeder does not use this factory. */
    private const SUBJECTS = [
        'Login fails after the latest update',
        'Invoice does not match the agreed plan',
        'Attachment upload times out',
        'Request to add a new team member',
        'Notification emails are delayed',
        'Export finishes but the file is empty',
        'Chat widget does not load on mobile',
        'Question about the renewal date',
        'Duplicate ticket created by the email connector',
        'Report totals differ from the dashboard',
        'Two-factor prompt appears on every sign-in',
        'Request to change the billing contact',
    ];

    private const OPENINGS = [
        'This started this morning and is affecting the whole team. Can you take a look?',
        'We noticed the problem yesterday. It is not urgent but we would like it resolved this week.',
        'Following up on the previous conversation — the issue is still happening.',
        'Could you confirm whether this is expected behaviour or something on our side?',
    ];

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'subject' => fake()->randomElement(self::SUBJECTS),
            'description' => fake()->randomElement(self::OPENINGS),
            'customer_id' => Customer::factory(),
            'status' => fake()->randomElement(TicketStatus::cases())->value,
            'priority' => fake()->randomElement(Priority::cases())->value,
            'category' => fake()->randomElement(Ticket::CATEGORIES),
            'channel' => fake()->randomElement(Channel::cases())->value,
            'assigned_to' => null,
            'created_by' => null,
        ];
    }

    public function assignedTo(User $user): static
    {
        return $this->state(fn (array $attributes) => [
            'assigned_to' => $user->id,
        ]);
    }

    public function unassigned(): static
    {
        return $this->state(fn (array $attributes) => [
            'assigned_to' => null,
        ]);
    }
}
