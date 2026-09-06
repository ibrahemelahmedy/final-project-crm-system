<?php

namespace Database\Factories;

use App\Models\Branch;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Branch>
 */
class BranchFactory extends Factory
{
    protected $model = Branch::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->city().' Branch',
            'region' => fake()->city().', '.fake()->countryCode(),
            'timezone' => 'UTC',
            'is_active' => true,
        ];
    }
}
