<?php

use App\Enums\UserRole;
use App\Models\KbArticle;
use App\Models\KbCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Every assertion here is an ORDERING PROPERTY, never an engine score.
 *
 * PostgreSQL ranks with ts_rank over a weighted tsvector; SQLite ranks with an
 * ordered CASE (App\Services\Kb\LikeArticleSearch). The numbers differ and
 * always will. What both guarantee — and what the API contract promises — is
 * that a title match outranks a body-only match, so this suite passes on the
 * driver local development runs AND on the target.
 */
beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->category = KbCategory::factory()->named('Troubleshooting')->create();

    $this->titleMatch = KbArticle::factory()
        ->withContent('Webhook delivery failures', 'A general note about retry policy and timeouts.')
        ->create(['kb_category_id' => $this->category->id]);

    $this->bodyMatch = KbArticle::factory()
        ->withContent('Configuring outbound alerts', 'Alerts are delivered by webhook to the endpoint you register.')
        ->create(['kb_category_id' => $this->category->id]);

    $this->unrelated = KbArticle::factory()
        ->withContent('Invoice line items explained', 'Proration and seat charges on a monthly bill.')
        ->create(['kb_category_id' => $this->category->id]);
});

it('ranks a title match above a body-only match', function () {
    $slugs = collect(
        $this->asUser($this->agent)->getJson('/api/kb/search?q=webhook')->assertOk()->json('data')
    )->pluck('slug');

    expect($slugs)->toContain($this->titleMatch->slug)
        ->toContain($this->bodyMatch->slug);

    expect($slugs->search($this->titleMatch->slug))
        ->toBeLessThan($slugs->search($this->bodyMatch->slug));
});

it('applies the same ranking to the list endpoint when a query is present', function () {
    // Ordering by the sort column while the user is searching is not a search
    // result — relevance wins over `sort` whenever `q` is set.
    $slugs = collect(
        $this->asUser($this->agent)
            ->getJson('/api/kb/articles?q=webhook&sort=title&dir=asc')
            ->assertOk()
            ->json('data')
    )->pluck('slug');

    expect($slugs->search($this->titleMatch->slug))
        ->toBeLessThan($slugs->search($this->bodyMatch->slug));
});

it('excludes rows matching neither the title nor the body', function () {
    $slugs = collect(
        $this->asUser($this->agent)->getJson('/api/kb/search?q=webhook')->json('data')
    )->pluck('slug');

    expect($slugs)->not->toContain($this->unrelated->slug);
});

it('returns 200 and an empty collection for a query that matches nothing', function () {
    // Never a 404 and never an error — the Empty state needs a successful
    // response with the query echoed back so it can quote it.
    $this->asUser($this->agent)
        ->getJson('/api/kb/search?q=zzzzznothingmatchesthis')
        ->assertOk()
        ->assertJsonCount(0, 'data')
        ->assertJsonPath('query', 'zzzzznothingmatchesthis');
});

it('returns 200 and an empty collection for an empty query', function () {
    // The picker mounts before the agent has typed anything.
    $this->asUser($this->agent)
        ->getJson('/api/kb/search?q=')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

it('honours the limit parameter and caps it', function () {
    KbArticle::factory()->count(20)->create([
        'kb_category_id' => $this->category->id,
        'title' => fn () => 'Webhook note '.fake()->unique()->numberBetween(1, 9999),
    ]);

    $this->asUser($this->agent)
        ->getJson('/api/kb/search?q=webhook&limit=3')
        ->assertOk()
        ->assertJsonCount(3, 'data');

    $this->asUser($this->agent)
        ->getJson('/api/kb/search?q=webhook&limit=500')
        ->assertStatus(422);
});

it('treats a wildcard character as literal text, not as a LIKE pattern', function () {
    // On the SQLite fallback an unescaped '%' would match every row.
    $this->asUser($this->agent)
        ->getJson('/api/kb/search?q=%25')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
