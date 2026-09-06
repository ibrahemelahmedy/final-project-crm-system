<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\PortalAccessCode;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<PortalAccessCode>
 */
class PortalAccessCodeFactory extends Factory
{
    public function definition(): array
    {
        $customer = Customer::factory()->create();

        return [
            'customer_id' => $customer->id,
            'identifier' => $customer->email ?? $customer->phone_normalized,
            'code_hash' => Hash::make('123456'),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
            'consumed_at' => null,
            'request_ip' => '127.0.0.1',
        ];
    }

    /** Sets a known plaintext so a test can verify against it. */
    public function withCode(string $code): static
    {
        return $this->state(fn () => ['code_hash' => Hash::make($code)]);
    }

    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subMinute()]);
    }

    public function consumed(): static
    {
        return $this->state(fn () => ['consumed_at' => now()]);
    }

    public function exhausted(): static
    {
        return $this->state(fn () => ['attempts' => 5]);
    }
}
