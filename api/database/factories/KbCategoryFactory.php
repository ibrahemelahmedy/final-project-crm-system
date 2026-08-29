<?php

namespace Database\Factories;

use App\Models\KbCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<KbCategory>
 */
class KbCategoryFactory extends Factory
{
    protected $model = KbCategory::class;

    public function definition(): array
    {
        $name = $this->faker->unique()->words(2, true);

        return [
            'name' => Str::title($name),
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'position' => 0,
        ];
    }

    public function named(string $name, int $position = 0): static
    {
        return $this->state(fn () => [
            'name' => $name,
            'slug' => Str::slug($name),
            'position' => $position,
        ]);
    }
}
