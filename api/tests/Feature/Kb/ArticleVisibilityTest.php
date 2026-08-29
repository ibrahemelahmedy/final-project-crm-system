<?php

use App\Enums\UserRole;
use App\Models\KbArticle;
use App\Models\KbCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $this->category = KbCategory::factory()->named('Billing')->create();

    $this->published = KbArticle::factory()->create([
        'title' => 'Published guidance',
        'slug' => 'published-guidance',
        'body' => 'Visible to everyone.',
        'kb_category_id' => $this->category->id,
    ]);

    $this->draft = KbArticle::factory()->draft()->create([
        'title' => 'Draft guidance',
        'slug' => 'draft-guidance',
        'body' => 'Only an editor sees this.',
        'kb_category_id' => $this->category->id,
    ]);
});

it('omits a draft from GET /api/kb/articles for an Agent', function () {
    $response = $this->asUser($this->agent)->getJson('/api/kb/articles');

    $response->assertOk()
        ->assertJsonFragment(['slug' => 'published-guidance'])
        ->assertJsonMissing(['slug' => 'draft-guidance']);
});

it('includes a draft in GET /api/kb/articles for an editor', function () {
    $this->asUser($this->lead)
        ->getJson('/api/kb/articles')
        ->assertOk()
        ->assertJsonFragment(['slug' => 'draft-guidance']);
});

it('omits a draft from GET /api/kb/search for an Agent', function () {
    // The status filter runs BEFORE ranking, so the draft never occupies one
    // of the result slots.
    $this->asUser($this->agent)
        ->getJson('/api/kb/search?q=guidance')
        ->assertOk()
        ->assertJsonFragment(['slug' => 'published-guidance'])
        ->assertJsonMissing(['slug' => 'draft-guidance']);
});

it("includes an editor's drafts in search, labelled with their status", function () {
    $response = $this->asUser($this->lead)->getJson('/api/kb/search?q=guidance');

    $response->assertOk()->assertJsonFragment(['slug' => 'draft-guidance']);

    $draft = collect($response->json('data'))->firstWhere('slug', 'draft-guidance');

    expect($draft['status'])->toBe('draft')
        ->and($draft['status_label'])->toBe('Draft');
});

it('returns 404 — not 403 — when an Agent fetches a draft by slug', function () {
    // A 403 would confirm the slug exists. The rule is enforced at the QUERY
    // level (KbArticle::scopeVisibleTo), so firstOrFail produces the 404.
    $this->asUser($this->agent)
        ->getJson('/api/kb/articles/draft-guidance')
        ->assertNotFound();
});

it('lets an editor fetch the same draft by slug', function () {
    $this->asUser($this->lead)
        ->getJson('/api/kb/articles/draft-guidance')
        ->assertOk()
        ->assertJsonPath('data.slug', 'draft-guidance');
});

it('excludes an archived article from an Agent view but keeps it for an editor', function () {
    $archived = KbArticle::factory()->archived()->create([
        'slug' => 'retired-guidance',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->agent)->getJson('/api/kb/articles')
        ->assertOk()->assertJsonMissing(['slug' => 'retired-guidance']);
    $this->asUser($this->agent)->getJson("/api/kb/articles/{$archived->slug}")->assertNotFound();

    $this->asUser($this->lead)->getJson("/api/kb/articles/{$archived->slug}")->assertOk();
});

it("scopes the category rail's counts to what the caller can see", function () {
    // An Agent's rail must not total in a draft they cannot open.
    $agentCount = $this->asUser($this->agent)->getJson('/api/kb/categories')
        ->assertOk()->json('data.0.article_count');

    $leadCount = $this->asUser($this->lead)->getJson('/api/kb/categories')
        ->assertOk()->json('data.0.article_count');

    expect($agentCount)->toBe(1)->and($leadCount)->toBe(2);
});

it('never surfaces a draft in the most-viewed rail, even for an editor', function () {
    KbArticle::where('slug', 'draft-guidance')->update(['view_count' => 99999]);

    $this->asUser($this->lead)
        ->getJson('/api/kb/articles/most-viewed')
        ->assertOk()
        ->assertJsonMissing(['slug' => 'draft-guidance']);
});

it('increments view_count on a read without moving updated_at', function () {
    // A view is not an edit — the reader's "Last updated" staleness signal
    // must not be reset by someone opening the page.
    $before = $this->published->fresh();

    $this->asUser($this->agent)->getJson('/api/kb/articles/published-guidance')->assertOk();

    $after = $this->published->fresh();

    expect($after->view_count)->toBe($before->view_count + 1)
        ->and($after->updated_at->timestamp)->toBe($before->updated_at->timestamp);
});
