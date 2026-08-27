<?php

namespace Database\Factories;

use App\Enums\CustomerTier;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => fake()->numerify('+1 (###) ###-####'),
            'company' => fake()->company(),
            'tier' => fake()->randomElement(CustomerTier::values()),
            'last_contact_at' => fake()->dateTimeBetween('-3 months', 'now'),
        ];
    }

    /**
     * A customer with no email, phone still set.
     */
    public function withoutEmail(): static
    {
        return $this->state(fn (array $attributes) => [
            'email' => null,
        ]);
    }

    // trashed() is provided by the SoftDeletes trait — not hand-rolled here.
}
