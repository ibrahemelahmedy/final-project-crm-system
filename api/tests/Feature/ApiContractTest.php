<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns json 401 for an unauthenticated protected request without Accept header', function () {
    // Calling endpoint without headers or Accept: application/json
    $response = $this->call('GET', '/api/user');

    $response->assertStatus(401)
        ->assertHeader('Content-Type', 'application/json');

    expect($response->headers->has('Location'))->toBeFalse();
});

it('exposes the Retry-After header to cross-origin callers', function () {
    // A real cross-origin request, not just the config array — this is the
    // only way to catch the browser-visible behaviour Task 7 depends on.
    $response = $this->withHeaders([
        'Origin' => config('cors.allowed_origins')[0],
    ])->getJson('/api/user');

    $response->assertHeader('Access-Control-Expose-Headers');
    expect($response->headers->get('Access-Control-Expose-Headers'))->toContain('Retry-After');
});

it('sets security headers on every API response', function () {
    $response = $this->getJson('/api/user');

    $response->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Frame-Options', 'DENY')
        ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
});

it('exposes the status transition map on GET /api/tickets/meta', function () {
    $user = \App\Models\User::factory()->create([
        'role' => \App\Enums\UserRole::TeamLead,
        'is_active' => true,
    ]);
    $token = $user->createToken('spa')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/tickets/meta');

    $response->assertOk();
    $open = $response->json('transitions.open');
    expect($open)->toContain('pending', 'resolved', 'closed');
    expect($open)->not->toContain('open');
});

it('locks the response shape of every dashboard widget endpoint (Story 07)', function () {
    \App\Models\SlaRule::factory()->forPriority('normal', 1440, 80)->create();

    $admin = \App\Models\User::factory()->create([
        'role' => \App\Enums\UserRole::Administrator,
        'is_active' => true,
    ]);
    $agent = \App\Models\User::factory()->create([
        'role' => \App\Enums\UserRole::Agent,
        'is_active' => true,
    ]);
    \App\Models\Ticket::factory()->create([
        'assigned_to' => $admin->id,
        'status' => 'open',
        'priority' => 'normal',
    ]);
    $auth = ['Authorization' => 'Bearer '.$admin->createToken('spa')->plainTextToken];

    $this->withHeaders($auth)->getJson('/api/dashboard/agent/summary')
        ->assertOk()->assertJsonStructure(['assigned_count', 'sla_risk_count', 'resolved_today_count']);

    $this->withHeaders($auth)->getJson('/api/dashboard/agent/queue')
        ->assertOk()->assertJsonStructure(['data' => [['id', 'subject', 'customer', 'priority', 'sla' => ['due_at', 'minutes_left', 'risk']]]]);

    $this->withHeaders($auth)->getJson('/api/dashboard/agent/sla-risk')
        ->assertOk()->assertJsonStructure(['data']);

    $this->withHeaders($auth)->getJson('/api/dashboard/team/summary')
        ->assertOk()->assertJsonStructure(['team_name', 'agent_count', 'open_count', 'escalation_count', 'sla_compliance_pct']);

    $this->withHeaders($auth)->getJson('/api/dashboard/team/workload')
        ->assertOk()->assertJsonStructure([['user_id', 'name', 'open_count']]);

    $this->withHeaders($auth)->getJson('/api/dashboard/team/escalations')
        ->assertOk()->assertJsonStructure(['data']);

    $this->withHeaders($auth)->getJson('/api/dashboard/admin/summary')
        ->assertOk()->assertJsonStructure(['user_count', 'active_sla_rule_count', 'audit_log_count']);
});

it('locks the Channels overview response shape inside auth:sanctum (Story 14)', function () {
    $user = \App\Models\User::factory()->create([
        'role' => \App\Enums\UserRole::Agent,
        'is_active' => true,
    ]);

    $this->withHeader('Authorization', 'Bearer '.$user->createToken('spa')->plainTextToken)
        ->getJson('/api/channels/overview')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [['value', 'label_key', 'status', 'ticket_count']],
            'meta' => ['period', 'from', 'to', 'total_tickets', 'has_tickets'],
        ])
        ->assertJsonPath('meta.period', '30d');
});

it('adds department, initials, and last_login_at to UserResource without renaming a key (Story 08)', function () {
    $user = \App\Models\User::factory()->create([
        'name' => 'Sarah Ahmed',
        'role' => \App\Enums\UserRole::TeamLead,
        'department' => 'Support Ops',
        'is_active' => true,
        'last_login_at' => now(),
    ]);

    $this->withHeader('Authorization', 'Bearer '.$user->createToken('spa')->plainTextToken)
        ->getJson('/api/user')
        ->assertOk()
        // Story 01's keys are still here, unrenamed.
        ->assertJsonStructure(['data' => [
            'id', 'name', 'email', 'role', 'role_label', 'home_route', 'is_active',
            'department', 'initials', 'last_login_at',
        ]])
        ->assertJsonPath('data.department', 'Support Ops')
        ->assertJsonPath('data.initials', 'SA')
        ->assertJsonPath('data.role_label', 'Team Lead')
        ->assertJsonPath('data.home_route', '/dashboard/team');
});

it('locks the response shape of the users, audit-log, and settings endpoints (Story 08)', function () {
    $admin = \App\Models\User::factory()->create([
        'role' => \App\Enums\UserRole::Administrator,
        'department' => 'Platform',
        'is_active' => true,
    ]);
    $auth = ['Authorization' => 'Bearer '.$admin->createToken('spa')->plainTextToken];

    \App\Models\AuditLog::create([
        'user_id' => $admin->id,
        'event' => \App\Services\AuditTrail::USER_CREATED,
        'email' => $admin->email,
        'context' => \App\Services\AuditTrail::target('user', $admin->id, $admin->name),
        'created_at' => now(),
    ]);

    $this->withHeaders($auth)->getJson('/api/admin/users')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [['id', 'name', 'email', 'role', 'role_label', 'is_active', 'department', 'initials', 'last_login_at']],
            'meta' => ['current_page', 'last_page', 'per_page', 'total'],
        ]);

    $this->withHeaders($auth)->getJson('/api/admin/users/facets')
        ->assertOk()
        ->assertJsonStructure([
            'roles' => [['value', 'label', 'count']],
            'departments',
            'total',
            'active_total',
            'department_total',
        ]);

    $this->withHeaders($auth)->getJson('/api/admin/audit-logs')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [[
                'id', 'event', 'event_label',
                'actor' => ['id', 'name', 'email'],
                'target' => ['type', 'id', 'label'],
                'ip_address', 'context', 'created_at',
            ]],
            'meta' => ['current_page', 'last_page', 'per_page', 'total'],
        ]);

    $this->withHeaders($auth)->getJson('/api/admin/audit-logs/facets')
        ->assertOk()
        ->assertJsonStructure(['events' => [['value', 'label', 'count']], 'actors', 'total']);

    $this->withHeaders($auth)->getJson('/api/admin/settings')
        ->assertOk()
        ->assertJsonStructure(['data' => [['key', 'label', 'type', 'value', 'default', 'help', 'min', 'max', 'updated_at']]]);

    $this->withHeaders($auth)->patchJson('/api/admin/settings', ['settings' => ['password_min_length' => 10]])
        ->assertOk()
        ->assertJsonStructure(['data', 'changed']);
});

it('keeps the public CSAT routes outside auth:sanctum and gated by signed + throttle:csat (Story 13)', function () {
    $routes = collect(\Illuminate\Support\Facades\Route::getRoutes()->getRoutes())
        ->filter(fn ($r) => in_array($r->getName(), ['csat.show', 'csat.store'], true));

    expect($routes)->toHaveCount(2);

    $routes->each(function ($route) {
        $mw = implode('|', $route->gatherMiddleware());
        expect($mw)->not->toContain('auth:sanctum');
        expect(str_contains($mw, 'signed') || str_contains($mw, 'ValidateSignature'))->toBeTrue();
        expect(str_contains($mw, 'throttle:csat') || str_contains($mw, 'ThrottleRequests:csat'))->toBeTrue();
    });
});

it('locks the Knowledge Base response shapes (Story 09)', function () {
    // The ticket-side ArticlePickerPanel and any later "suggested solutions"
    // story consume KbArticleSummaryResource. Its shape cannot drift silently.
    $editor = \App\Models\User::factory()->create([
        'role' => \App\Enums\UserRole::Administrator,
        'is_active' => true,
    ]);
    $category = \App\Models\KbCategory::factory()->named('Account & Access')->create();
    $article = \App\Models\KbArticle::factory()->create([
        'title' => 'Contract article',
        'body' => "Intro.\n\n## A section\n\nMore text.",
        'kb_category_id' => $category->id,
    ]);

    $auth = ['Authorization' => 'Bearer '.$editor->createToken('spa')->plainTextToken];

    $summaryShape = [
        'id', 'title', 'slug', 'excerpt', 'status', 'status_label',
        'category', 'view_count', 'published_at', 'updated_at',
    ];

    $this->withHeaders($auth)->getJson('/api/kb/articles')
        ->assertOk()
        ->assertJsonStructure(['data' => [$summaryShape], 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);

    $this->withHeaders($auth)->getJson('/api/kb/articles/most-viewed')
        ->assertOk()
        ->assertJsonStructure(['data']);

    $this->withHeaders($auth)->getJson('/api/kb/categories')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [['id', 'name', 'slug', 'article_count']],
            'total',
            'published_total',
        ]);

    // The picker's contract: data[] of summaries plus the echoed query, which
    // the Empty state quotes back to the agent.
    $this->withHeaders($auth)->getJson('/api/kb/search?q=contract')
        ->assertOk()
        ->assertJsonStructure(['data' => [$summaryShape], 'query']);

    // The reader payload. `body_html` is the sanitized render and the only
    // field the client puts in the DOM; `body` is raw Markdown for the editor.
    $this->withHeaders($auth)->getJson("/api/kb/articles/{$article->slug}")
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                'id', 'title', 'slug', 'body', 'body_html', 'excerpt',
                'status', 'status_label', 'category' => ['id', 'name', 'slug'],
                'author', 'view_count', 'published_at', 'created_at', 'updated_at',
                'version_count', 'read_minutes', 'direction',
                'toc' => [['id', 'text', 'level']],
            ],
        ]);

    $this->withHeaders($auth)
        ->postJson('/api/kb/articles/bulk', ['action' => 'unpublish', 'ids' => [$article->id]])
        ->assertOk()
        ->assertJsonStructure(['action', 'affected', 'skipped']);
});
