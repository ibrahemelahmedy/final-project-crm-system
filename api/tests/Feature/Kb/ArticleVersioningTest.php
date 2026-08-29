<?php

use App\Enums\UserRole;
use App\Models\KbArticle;
use App\Models\KbArticleVersion;
use App\Models\KbCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->editor = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $this->other = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $this->category = KbCategory::factory()->named('Billing')->create();
});

it('inserts exactly one version row when a published article is edited', function () {
    $article = KbArticle::factory()->create([
        'title' => 'Original title',
        'body' => 'Original body.',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->editor)
        ->patchJson("/api/kb/articles/{$article->slug}", ['body' => 'Revised body.'])
        ->assertOk();

    expect(KbArticleVersion::where('kb_article_id', $article->id)->count())->toBe(1);
});

it('snapshots the PRE-edit title and body, not the new one', function () {
    $article = KbArticle::factory()->create([
        'title' => 'Original title',
        'body' => 'Original body.',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->editor)->patchJson("/api/kb/articles/{$article->slug}", [
        'title' => 'Revised title',
        'body' => 'Revised body.',
    ])->assertOk();

    $version = KbArticleVersion::where('kb_article_id', $article->id)->first();

    expect($version->title)->toBe('Original title')
        ->and($version->body)->toBe('Original body.')
        ->and($version->edited_by)->toBe($this->editor->id);

    expect($article->fresh()->title)->toBe('Revised title');
});

it('moves the visible last-updated timestamp on an edit', function () {
    // The reader's staleness signal — agents rely on it to tell whether
    // guidance is current.
    $article = KbArticle::factory()->create([
        'body' => 'Original body.',
        'kb_category_id' => $this->category->id,
        'updated_at' => now()->subDays(10),
    ]);
    $before = $article->updated_at;

    $this->asUser($this->editor)
        ->patchJson("/api/kb/articles/{$article->slug}", ['body' => 'Revised body.'])
        ->assertOk();

    expect($article->fresh()->updated_at->greaterThan($before))->toBeTrue();
});

it('versions a draft edit through the same path', function () {
    $article = KbArticle::factory()->draft()->create([
        'body' => 'Draft body.',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->editor)
        ->patchJson("/api/kb/articles/{$article->slug}", ['body' => 'Draft body, revised.'])
        ->assertOk();

    expect(KbArticleVersion::where('kb_article_id', $article->id)->count())->toBe(1);
});

it('records one version per write under concurrent edits so nothing is lost', function () {
    // Last write wins on the article row; every write still leaves its
    // predecessor behind. No optimistic-locking column is added.
    $article = KbArticle::factory()->create([
        'body' => 'v1',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->editor)
        ->patchJson("/api/kb/articles/{$article->slug}", ['body' => 'v2'])->assertOk();
    $this->asUser($this->other)
        ->patchJson("/api/kb/articles/{$article->slug}", ['body' => 'v3'])->assertOk();

    $bodies = KbArticleVersion::where('kb_article_id', $article->id)
        ->orderBy('id')
        ->pluck('body')
        ->all();

    expect($bodies)->toBe(['v1', 'v2'])
        ->and($article->fresh()->body)->toBe('v3');
});

it('exposes the version count on the reader payload', function () {
    $article = KbArticle::factory()->create([
        'body' => 'v1',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->editor)
        ->patchJson("/api/kb/articles/{$article->slug}", ['body' => 'v2'])->assertOk();

    $this->asUser($this->editor)
        ->getJson("/api/kb/articles/{$article->slug}")
        ->assertOk()
        ->assertJsonPath('data.version_count', 1);
});

it('does not write a version row when an article is merely published', function () {
    // A status transition is not a content edit; it is already recorded in
    // the audit trail.
    $article = KbArticle::factory()->draft()->create([
        'body' => 'Body.',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->editor)->postJson("/api/kb/articles/{$article->slug}/publish")->assertOk();

    expect(KbArticleVersion::where('kb_article_id', $article->id)->count())->toBe(0);
});
