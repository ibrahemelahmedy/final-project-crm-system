<?php

namespace Database\Factories;

use App\Enums\ArticleStatus;
use App\Models\KbArticle;
use App\Models\KbCategory;
use App\Models\User;
use App\Services\MarkdownRenderer;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<KbArticle>
 */
class KbArticleFactory extends Factory
{
    protected $model = KbArticle::class;

    public function definition(): array
    {
        $title = Str::ucfirst($this->faker->unique()->sentence(5));
        $body = $this->markdownBody();

        return [
            'title' => $title,
            'slug' => Str::slug($title).'-'.Str::lower(Str::random(5)),
            'body' => $body,
            // The factory runs the SAME renderer the controller does, so a
            // factory-made row is never a shape the app could not produce —
            // and body_html is never left null on a row a test then reads.
            'body_html' => fn (array $attrs) => app(MarkdownRenderer::class)->render($attrs['body']),
            'excerpt' => fn (array $attrs) => app(MarkdownRenderer::class)->excerpt($attrs['body_html']),
            'kb_category_id' => KbCategory::factory(),
            'status' => ArticleStatus::Published,
            'author_id' => User::factory(),
            'published_at' => now()->subDays($this->faker->numberBetween(1, 60)),
            'view_count' => $this->faker->numberBetween(0, 900),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => [
            'status' => ArticleStatus::Draft,
            'published_at' => null,
        ]);
    }

    public function archived(): static
    {
        return $this->state(fn () => ['status' => ArticleStatus::Archived]);
    }

    public function inCategory(KbCategory $category): static
    {
        return $this->state(fn () => ['kb_category_id' => $category->id]);
    }

    /** Explicit title AND body, for the search-ranking assertions. */
    public function withContent(string $title, string $body): static
    {
        return $this->state(fn () => [
            'title' => $title,
            'slug' => Str::slug($title).'-'.Str::lower(Str::random(5)),
            'body' => $body,
            'body_html' => app(MarkdownRenderer::class)->render($body),
            'excerpt' => app(MarkdownRenderer::class)->excerpt(app(MarkdownRenderer::class)->render($body)),
        ]);
    }

    private function markdownBody(): string
    {
        return implode("\n\n", [
            $this->faker->paragraph(),
            '## '.Str::ucfirst($this->faker->words(3, true)),
            $this->faker->paragraph(),
            '## '.Str::ucfirst($this->faker->words(3, true)),
            $this->faker->paragraph(),
        ]);
    }
}
