<?php

use App\Enums\ArticleStatus;
use App\Enums\UserRole;
use App\Models\KbArticle;
use App\Models\KbCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->editor = User::factory()->create([
        'role' => UserRole::Administrator,
        'is_active' => true,
    ]);

    $this->category = KbCategory::factory()->named('Account & Access')->create();
});

it('creates a draft with only a title', function () {
    // The AC is "required before it can be PUBLISHED" — parking a title and
    // coming back to it must work.
    $response = $this->asUser($this->editor)
        ->postJson('/api/kb/articles', ['title' => 'Rotating an API key']);

    $response->assertCreated()
        ->assertJsonPath('data.title', 'Rotating an API key')
        ->assertJsonPath('data.slug', 'rotating-an-api-key')
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.published_at', null);

    expect(KbArticle::where('slug', 'rotating-an-api-key')->exists())->toBeTrue();
});

it('rejects publishing without a body or a category, naming each missing field', function () {
    $article = KbArticle::factory()->draft()->create([
        'title' => 'Titles only',
        'body' => null,
        'kb_category_id' => null,
    ]);

    $this->asUser($this->editor)
        ->postJson("/api/kb/articles/{$article->slug}/publish")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['body', 'kb_category_id']);

    expect($article->fresh()->status)->toBe(ArticleStatus::Draft);
});

it('rejects publishing when only the category is missing', function () {
    $article = KbArticle::factory()->draft()->create([
        'body' => 'A real body.',
        'kb_category_id' => null,
    ]);

    $this->asUser($this->editor)
        ->postJson("/api/kb/articles/{$article->slug}/publish")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['kb_category_id'])
        ->assertJsonMissingValidationErrors(['body', 'title']);
});

it('publishes a complete article and stamps published_at', function () {
    $article = KbArticle::factory()->draft()->create([
        'title' => 'Complete article',
        'body' => 'Body text.',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->editor)
        ->postJson("/api/kb/articles/{$article->slug}/publish")
        ->assertOk()
        ->assertJsonPath('data.status', 'published');

    $fresh = $article->fresh();

    expect($fresh->status)->toBe(ArticleStatus::Published)
        ->and($fresh->published_at)->not->toBeNull();
});

it('keeps the original published_at when an article is unpublished and republished', function () {
    // "Published <date>" means when it FIRST went live; a round trip through
    // draft must not silently re-date it.
    $article = KbArticle::factory()->create([
        'kb_category_id' => $this->category->id,
        'published_at' => now()->subDays(30),
    ]);
    $original = $article->published_at;

    $this->asUser($this->editor)->postJson("/api/kb/articles/{$article->slug}/unpublish")->assertOk();
    $this->asUser($this->editor)->postJson("/api/kb/articles/{$article->slug}/publish")->assertOk();

    expect($article->fresh()->published_at->timestamp)->toBe($original->timestamp);
});

it('unpublishes a published article back to draft', function () {
    $article = KbArticle::factory()->create(['kb_category_id' => $this->category->id]);

    $this->asUser($this->editor)
        ->postJson("/api/kb/articles/{$article->slug}/unpublish")
        ->assertOk()
        ->assertJsonPath('data.status', 'draft');

    expect($article->fresh()->status)->toBe(ArticleStatus::Draft);
});

it('appends a numeric suffix when a new article collides with an existing slug', function () {
    KbArticle::factory()->create(['title' => 'Duplicate title', 'slug' => 'duplicate-title']);

    $this->asUser($this->editor)
        ->postJson('/api/kb/articles', ['title' => 'Duplicate title'])
        ->assertCreated()
        ->assertJsonPath('data.slug', 'duplicate-title-2');
});

it('never repoints an existing slug when the title is renamed', function () {
    // A link pasted into a ticket reply months ago must still resolve, so the
    // slug is frozen at creation — see KbArticle::freshSlug().
    $article = KbArticle::factory()->create([
        'title' => 'Original title',
        'slug' => 'original-title',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->editor)
        ->patchJson("/api/kb/articles/{$article->slug}", ['title' => 'A completely different title'])
        ->assertOk()
        ->assertJsonPath('data.title', 'A completely different title')
        ->assertJsonPath('data.slug', 'original-title');

    $this->asUser($this->editor)->getJson('/api/kb/articles/original-title')->assertOk();
});

it('refuses to edit a published article into an unpublishable state', function () {
    // Otherwise "a body is required to publish" is bypassed by publishing
    // first and blanking the body afterwards.
    $article = KbArticle::factory()->create([
        'body' => 'A real body.',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->editor)
        ->patchJson("/api/kb/articles/{$article->slug}", ['body' => ''])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['body']);

    expect($article->fresh()->body)->toBe('A real body.');
});

it('archives an article through the bulk endpoint and reports what it skipped', function () {
    $ok = KbArticle::factory()->draft()->create([
        'body' => 'Publishable.',
        'kb_category_id' => $this->category->id,
    ]);
    $incomplete = KbArticle::factory()->draft()->create([
        'title' => 'No category',
        'body' => 'Has a body.',
        'kb_category_id' => null,
    ]);

    // One incomplete draft in a selection must not block the rest.
    $this->asUser($this->editor)
        ->postJson('/api/kb/articles/bulk', ['action' => 'publish', 'ids' => [$ok->id, $incomplete->id]])
        ->assertOk()
        ->assertJsonPath('affected', 1)
        ->assertJsonPath('skipped.0.id', $incomplete->id);

    expect($ok->fresh()->status)->toBe(ArticleStatus::Published)
        ->and($incomplete->fresh()->status)->toBe(ArticleStatus::Draft);

    $this->asUser($this->editor)
        ->postJson('/api/kb/articles/bulk', ['action' => 'archive', 'ids' => [$ok->id]])
        ->assertOk()
        ->assertJsonPath('affected', 1);

    expect($ok->fresh()->status)->toBe(ArticleStatus::Archived);
});

it('writes an audit row through AuditTrail for publish, unpublish, and archive', function () {
    $article = KbArticle::factory()->draft()->create([
        'body' => 'Body.',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->editor)->postJson("/api/kb/articles/{$article->slug}/publish")->assertOk();
    $this->asUser($this->editor)->postJson("/api/kb/articles/{$article->slug}/unpublish")->assertOk();
    $this->asUser($this->editor)->postJson("/api/kb/articles/{$article->slug}/archive")->assertOk();

    $events = \App\Models\AuditLog::pluck('event')->all();

    expect($events)->toContain('kb_article.published')
        ->toContain('kb_article.unpublished')
        ->toContain('kb_article.archived');
});
