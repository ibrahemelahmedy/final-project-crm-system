<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Department;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Department>
 */
class DepartmentFactory extends Factory
{
    protected $model = Department::class;

    public function definition(): array
    {
        return [
            // Defaults to a fresh Branch so a test can create a department
            // without knowing about branches.
            'branch_id' => Branch::factory(),
            'name' => fake()->unique()->jobTitle(),
            'is_active' => true,
        ];
    }
}
