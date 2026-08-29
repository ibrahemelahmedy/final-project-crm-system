<?php

use App\Enums\UserRole;
use App\Exceptions\AuditLogIsAppendOnly;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditTrail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create([
        'name' => 'System Admin',
        'email' => 'admin@wisal.test',
        'role' => UserRole::Administrator,
        'is_active' => true,
    ]);

    $this->token = $this->admin->createToken('spa')->plainTextToken;
    $this->asToken($this->token);
});

it('writes exactly one row with actor, event, target and timestamp for each sensitive action', function () {
    $created = $this->postJson('/api/admin/users', [
        'name' => 'Lena Torres',
        'email' => 'lena@wisal.io',
        'role' => UserRole::Agent->value,
    ])->assertCreated()->json('data.id');

    $this->patchJson("/api/admin/users/{$created}", ['role' => UserRole::TeamLead->value])->assertOk();
    $this->postJson("/api/admin/users/{$created}/deactivate")->assertOk();
    $this->patchJson('/api/admin/settings', ['settings' => ['password_min_length' => 12]])->assertOk();

    foreach ([
        AuditTrail::USER_CREATED,
        AuditTrail::USER_ROLE_CHANGED,
        AuditTrail::USER_DEACTIVATED,
        AuditTrail::SETTING_CHANGED,
    ] as $event) {
        $row = AuditLog::where('event', $event)->sole();

        expect($row->user_id)->toBe($this->admin->id);          // actor
        expect($row->event)->toBe($event);                       // action
        expect($row->context['target_id'])->not->toBeNull();     // target
        expect($row->created_at)->not->toBeNull();               // timestamp
    }
});

it('filters by actor, event, and date range, each narrowing correctly', function () {
    $otherAdmin = User::factory()->create(['name' => 'Other Admin', 'role' => UserRole::Administrator, 'is_active' => true]);
    $subject = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    AuditLog::create([
        'user_id' => $this->admin->id, 'event' => AuditTrail::USER_CREATED, 'email' => $this->admin->email,
        'context' => AuditTrail::target('user', $subject->id, 'Subject'), 'created_at' => now()->subDays(10),
    ]);
    AuditLog::create([
        'user_id' => $otherAdmin->id, 'event' => AuditTrail::USER_DEACTIVATED, 'email' => $otherAdmin->email,
        'context' => AuditTrail::target('user', $subject->id, 'Subject'), 'created_at' => now()->subDays(2),
    ]);
    AuditLog::create([
        'user_id' => $otherAdmin->id, 'event' => AuditTrail::SETTING_CHANGED, 'email' => $otherAdmin->email,
        'context' => AuditTrail::target('setting', 'password_min_length', 'Minimum password length'), 'created_at' => now(),
    ]);

    $this->getJson('/api/admin/audit-logs')->assertOk()->assertJsonPath('meta.total', 3);

    $this->getJson("/api/admin/audit-logs?actor_id={$otherAdmin->id}")
        ->assertOk()->assertJsonPath('meta.total', 2);

    $this->getJson('/api/admin/audit-logs?event[]='.AuditTrail::SETTING_CHANGED)
        ->assertOk()->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.event', AuditTrail::SETTING_CHANGED)
        ->assertJsonPath('data.0.event_label', 'Setting changed');

    // From/to are inclusive whole days, so "the last 3 days" catches the
    // row written 2 days ago and today's, and not the one 10 days back.
    $this->getJson('/api/admin/audit-logs?from='.now()->subDays(3)->toDateString().'&to='.now()->toDateString())
        ->assertOk()->assertJsonPath('meta.total', 2);

    $this->getJson("/api/admin/audit-logs?actor_id={$otherAdmin->id}&event[]=".AuditTrail::USER_DEACTIVATED)
        ->assertOk()->assertJsonPath('meta.total', 1);
});

it('rejects a to date before the from date', function () {
    $this->getJson('/api/admin/audit-logs?from=2026-08-20&to=2026-08-10')
        ->assertStatus(422)
        ->assertJsonValidationErrors('to');
});

it('paginates server-side and rejects a per_page above the hard ceiling', function () {
    for ($i = 0; $i < 40; $i++) {
        AuditLog::create([
            'user_id' => $this->admin->id,
            'event' => AuditTrail::USER_UPDATED,
            'email' => $this->admin->email,
            'created_at' => now()->subMinutes($i),
        ]);
    }

    $this->getJson('/api/admin/audit-logs?per_page=15')
        ->assertOk()
        ->assertJsonCount(15, 'data')
        ->assertJsonPath('meta.total', 40)
        ->assertJsonPath('meta.per_page', 15)
        ->assertJsonPath('meta.last_page', 3);

    $this->getJson('/api/admin/audit-logs?per_page=15&page=3')
        ->assertOk()
        ->assertJsonCount(10, 'data');

    $this->getJson('/api/admin/audit-logs?per_page=100000')
        ->assertStatus(422)
        ->assertJsonValidationErrors('per_page');
});

it('orders newest first', function () {
    AuditLog::create(['user_id' => $this->admin->id, 'event' => AuditTrail::USER_CREATED, 'created_at' => now()->subDay()]);
    AuditLog::create(['user_id' => $this->admin->id, 'event' => AuditTrail::USER_DEACTIVATED, 'created_at' => now()]);

    $this->getJson('/api/admin/audit-logs')
        ->assertOk()
        ->assertJsonPath('data.0.event', AuditTrail::USER_DEACTIVATED);
});

it('renders the retained email as the actor when user_id is null', function () {
    AuditLog::create([
        'user_id' => null,
        'event' => AuditTrail::LOGIN_FAILED,
        'email' => 'ghost@wisal.io',
        'created_at' => now(),
    ]);

    $this->getJson('/api/admin/audit-logs?event[]='.AuditTrail::LOGIN_FAILED)
        ->assertOk()
        ->assertJsonPath('data.0.actor.id', null)
        ->assertJsonPath('data.0.actor.name', 'ghost@wisal.io');
});

it('exposes NO route accepting PUT, PATCH, or DELETE on an audit row', function () {
    foreach (Route::getRoutes() as $route) {
        if (! str_contains($route->uri(), 'audit-log')) {
            continue;
        }

        foreach ($route->methods() as $method) {
            expect($method)->not->toBeIn(['PUT', 'PATCH', 'DELETE', 'POST']);
        }
    }

    $row = AuditLog::create(['user_id' => $this->admin->id, 'event' => AuditTrail::USER_CREATED, 'created_at' => now()]);

    $this->putJson("/api/admin/audit-logs/{$row->id}")->assertStatus(404);
    $this->patchJson("/api/admin/audit-logs/{$row->id}")->assertStatus(404);
    $this->deleteJson("/api/admin/audit-logs/{$row->id}")->assertStatus(404);
    $this->postJson('/api/admin/audit-logs')->assertStatus(405);
});

it('throws on a direct model update or delete — the audit log is append-only', function () {
    $row = AuditLog::create(['user_id' => $this->admin->id, 'event' => AuditTrail::USER_CREATED, 'created_at' => now()]);

    expect(fn () => $row->update(['event' => 'tampered']))->toThrow(AuditLogIsAppendOnly::class);
    expect(fn () => $row->delete())->toThrow(AuditLogIsAppendOnly::class);

    $reloaded = AuditLog::find($row->id);
    expect($reloaded)->not->toBeNull();
    expect($reloaded->event)->toBe(AuditTrail::USER_CREATED);
});

it('offers the events and actors the viewer filters by', function () {
    AuditLog::create(['user_id' => $this->admin->id, 'event' => AuditTrail::USER_CREATED, 'email' => $this->admin->email, 'created_at' => now()]);

    $response = $this->getJson('/api/admin/audit-logs/facets')->assertOk();

    $events = collect($response->json('events'));
    expect($events->pluck('value'))->toContain(AuditTrail::USER_CREATED, AuditTrail::SETTING_CHANGED);
    expect($events->firstWhere('value', AuditTrail::USER_CREATED)['count'])->toBe(1);
    expect($response->json('actors.0.value'))->toBe($this->admin->id);
});

it('indexes every filter combination the viewer offers', function () {
    // The log grows unbounded, so each of the three filter shapes the viewer
    // exposes needs a leading index column. Story 01's ['event','created_at']
    // covers only the event path — EXPLAIN on pgsql showed the other two
    // falling back to a seq scan before these were added.
    $indexes = collect(Schema::getIndexes('audit_logs'))
        ->map(fn (array $index) => $index['columns'])
        ->values()
        ->all();

    expect($indexes)->toContain(['event', 'created_at']);   // event + date range
    expect($indexes)->toContain(['created_at']);            // date range alone
    expect($indexes)->toContain(['user_id', 'created_at']); // actor + date range
});
