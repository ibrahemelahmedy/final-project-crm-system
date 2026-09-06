<?php

namespace Database\Factories;

use App\Enums\IntegrationStatus;
use App\Enums\IntegrationType;
use App\Models\Integration;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Integration>
 *
 * Story 18 (WIS-19). Defaults to a connected `erp` row. There is no seeder
 * entry for this model — a seeded integration would show a fabricated
 * CONNECTED card on a fresh install, which is exactly what Story 14's
 * honest not-connected framing exists to avoid.
 */
class IntegrationFactory extends Factory
{
    protected $model = Integration::class;

    public function definition(): array
    {
        $secret = 'sk_test_'.Str::random(24);

        return [
            'type' => IntegrationType::Erp->value,
            'endpoint_url' => 'https://api.example-erp.test/v1',
            'secret' => $secret,
            'secret_last_four' => substr($secret, -4),
            'status' => IntegrationStatus::Connected->value,
            'last_checked_at' => now()->subHours(3),
            'last_check_failed_at' => null,
            'last_error' => null,
            'connected_by' => User::factory(),
        ];
    }

    public function error(): static
    {
        return $this->state(fn () => [
            'status' => IntegrationStatus::Error->value,
            'last_checked_at' => null,
            'last_check_failed_at' => now()->subMinutes(10),
            'last_error' => 'integrations.error.unreachable',
        ]);
    }
}
