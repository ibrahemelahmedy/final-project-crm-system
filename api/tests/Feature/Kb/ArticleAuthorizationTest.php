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
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->category = KbCategory::factory()->named('Integrations')->create();
    $this->article = KbArticle::factory()->create([
        'slug' => 'an-article',
        'body' => 'Body.',
        'kb_category_id' => $this->category->id,
    ]);
});

it('refuses every write verb for an Agent', function () {
    $agent = $this->agent;

    $this->asUser($agent)
        ->postJson('/api/kb/articles', ['title' => 'Attempted'])
        ->assertForbidden();

    $this->asUser($agent)
        ->patchJson("/api/kb/articles/{$this->article->slug}", ['title' => 'Attempted'])
        ->assertForbidden();

    $this->asUser($agent)
        ->postJson("/api/kb/articles/{$this->article->slug}/publish")
        ->assertForbidden();

    $this->asUser($agent)
        ->postJson("/api/kb/articles/{$this->article->slug}/unpublish")
        ->assertForbidden();

    $this->asUser($agent)
        ->postJson("/api/kb/articles/{$this->article->slug}/archive")
        ->assertForbidden();

    $this->asUser($agent)
        ->postJson('/api/kb/articles/bulk', ['action' => 'archive', 'ids' => [$this->article->id]])
        ->assertForbidden();

    expect($this->article->fresh()->title)->not->toBe('Attempted');
});

it('allows every read verb for an Agent', function () {
    // Reading is universal; authoring is not.
    $this->asUser($this->agent)->getJson('/api/kb/articles')->assertOk();
    $this->asUser($this->agent)->getJson("/api/kb/articles/{$this->article->slug}")->assertOk();
    $this->asUser($this->agent)->getJson('/api/kb/articles/most-viewed')->assertOk();
    $this->asUser($this->agent)->getJson('/api/kb/categories')->assertOk();
    $this->asUser($this->agent)->getJson('/api/kb/search?q=body')->assertOk();
});

it('allows a Team Lead to author, not only an Administrator', function () {
    // "Editor" is Team Lead OR Administrator — a two-role predicate the
    // single-role `administrator` gate cannot express, which is why the
    // policy carries it rather than a route middleware.
    $this->asUser($this->lead)
        ->postJson('/api/kb/articles', ['title' => 'Written by a lead'])
        ->assertCreated();

    $this->asUser($this->admin)
        ->postJson('/api/kb/articles', ['title' => 'Written by an admin'])
        ->assertCreated();
});

it('rejects an unauthenticated request to every KB endpoint', function () {
    $this->getJson('/api/kb/articles')->assertUnauthorized();
    $this->getJson('/api/kb/categories')->assertUnauthorized();
    $this->getJson('/api/kb/search?q=x')->assertUnauthorized();
    $this->getJson("/api/kb/articles/{$this->article->slug}")->assertUnauthorized();
    $this->postJson('/api/kb/articles', ['title' => 'x'])->assertUnauthorized();
});

it('blocks a deactivated user from reading the KB', function () {
    // The group's `active` middleware, inherited — a deactivation bites on the
    // user's NEXT request, not their next login. 401, not 403: Story 08's
    // ActiveUserOnly treats a deactivated account as no longer authenticated
    // and destroys the token on the way out.
    $disabled = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => false]);

    $this->asUser($disabled)->getJson('/api/kb/articles')->assertStatus(401);
});

it('keeps every /api/kb route inside the authenticated group', function () {
    // Walks the REAL route list, so a new KB endpoint cannot be added without
    // its guards — the same assertion Story 08 makes over /api/admin.
    $routes = collect(app('router')->getRoutes()->getRoutes())
        ->filter(fn ($route) => str_starts_with($route->uri(), 'api/kb'));

    expect($routes)->not->toBeEmpty();

    $routes->each(function ($route) {
        expect($route->gatherMiddleware())
            ->toContain('auth:sanctum')
            ->toContain('active');
    });
});
