<?php

use App\Models\KbArticle;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('lists published articles for an unauthenticated caller', function () {
    $published = KbArticle::factory()->create(['status' => 'published', 'published_at' => now()]);
    $draft = KbArticle::factory()->create(['status' => 'draft', 'published_at' => null]);

    $res = $this->getJson('/api/portal/faq')->assertOk();

    $slugs = collect($res->json('data'))->pluck('slug');
    expect($slugs)->toContain($published->slug)->and($slugs)->not->toContain($draft->slug);
});

it('returns 404 for a draft or archived slug', function () {
    $draft = KbArticle::factory()->create(['status' => 'draft', 'published_at' => null]);
    $archived = KbArticle::factory()->create(['status' => 'archived', 'published_at' => now()->subMonth()]);

    $this->getJson("/api/portal/faq/{$draft->slug}")->assertStatus(404);
    $this->getJson("/api/portal/faq/{$archived->slug}")->assertStatus(404);
});

it('increments view_count without moving updated_at', function () {
    $article = KbArticle::factory()->create(['status' => 'published', 'published_at' => now(), 'view_count' => 0]);
    $originalUpdatedAt = $article->updated_at;

    $this->travel(1)->minutes();
    $this->getJson("/api/portal/faq/{$article->slug}")->assertOk();

    $article->refresh();
    expect($article->view_count)->toBe(1);
    expect($article->updated_at->eq($originalUpdatedAt))->toBeTrue();
});

it('carries no body, author, status, or view_count key', function () {
    $article = KbArticle::factory()->create(['status' => 'published', 'published_at' => now()]);

    $res = $this->getJson("/api/portal/faq/{$article->slug}")->assertOk();

    $keys = array_keys($res->json());
    expect($keys)->not->toContain('body')
        ->and($keys)->not->toContain('author')
        ->and($keys)->not->toContain('status')
        ->and($keys)->not->toContain('view_count');
});
