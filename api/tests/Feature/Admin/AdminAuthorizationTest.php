<?php

use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    // A concrete target so {user} model binding resolves — otherwise a 404
    // would mask the 403 the guard is supposed to produce.
    $this->target = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    // Story 20 (WIS-20). Concrete {branch} / {department} targets for the
    // same reason.
    $this->branch = Branch::factory()->create();
    $this->department = Department::factory()->create(['branch_id' => $this->branch->id]);
});

/**
 * Every registered /api/admin/* route, as [method, uri] with {user}, {type},
 * {branch}, and {department} bound to a real id / a real IntegrationType
 * value. Derived from the router itself, not a hand-maintained list, so a
 * new admin endpoint added without a guard fails this test the day it lands.
 *
 * @return array<int, array{0: string, 1: string}>
 */
function adminRoutes(int $targetId, int $branchId, int $departmentId): array
{
    $out = [];

    foreach (Route::getRoutes() as $route) {
        if (! str_starts_with($route->uri(), 'api/admin/')) {
            continue;
        }

        foreach ($route->methods() as $method) {
            if (in_array($method, ['HEAD', 'OPTIONS'], true)) {
                continue;
            }

            $uri = str_replace(
                ['{user}', '{type}', '{branch}', '{department}'],
                [(string) $targetId, 'erp', (string) $branchId, (string) $departmentId],
                $route->uri()
            );
            $out[] = [$method, '/'.$uri];
        }
    }

    return $out;
}

it('registers at least the eleven contracted admin endpoints', function () {
    $uris = collect(adminRoutes($this->target->id, $this->branch->id, $this->department->id))
        ->map(fn ($r) => $r[0].' '.$r[1])->all();

    expect($uris)->toContain('GET /api/admin/users')
        ->toContain('POST /api/admin/users')
        ->toContain('PATCH /api/admin/users/'.$this->target->id)
        ->toContain('POST /api/admin/users/'.$this->target->id.'/deactivate')
        ->toContain('POST /api/admin/users/'.$this->target->id.'/activate')
        ->toContain('GET /api/admin/audit-logs')
        ->toContain('GET /api/admin/settings')
        ->toContain('PATCH /api/admin/settings')
        ->toContain('GET /api/admin/integrations')
        ->toContain('PUT /api/admin/integrations/erp')
        ->toContain('POST /api/admin/integrations/erp/test')
        ->toContain('DELETE /api/admin/integrations/erp')
        ->toContain('GET /api/admin/branches')
        ->toContain('POST /api/admin/branches')
        ->toContain('PATCH /api/admin/branches/'.$this->branch->id)
        ->toContain('GET /api/admin/departments')
        ->toContain('POST /api/admin/departments')
        ->toContain('PATCH /api/admin/departments/'.$this->department->id)
        ->toContain('GET /api/admin/branding')
        ->toContain('PATCH /api/admin/branding')
        ->toContain('POST /api/admin/branding/logo')
        ->toContain('DELETE /api/admin/branding/logo');
});

it('denies an Agent on EVERY /api/admin/* route', function () {
    $token = $this->agent->createToken('spa')->plainTextToken;

    foreach (adminRoutes($this->target->id, $this->branch->id, $this->department->id) as [$method, $uri]) {
        $response = $this->asToken($token)
            ->json($method, $uri);

        expect($response->status())->toBe(403);
    }
});

it('denies a Team Lead on EVERY /api/admin/* route', function () {
    $token = $this->lead->createToken('spa')->plainTextToken;

    foreach (adminRoutes($this->target->id, $this->branch->id, $this->department->id) as [$method, $uri]) {
        $response = $this->asToken($token)
            ->json($method, $uri);

        expect($response->status())->toBe(403);
    }
});

it('denies an unauthenticated caller on EVERY /api/admin/* route', function () {
    foreach (adminRoutes($this->target->id, $this->branch->id, $this->department->id) as [$method, $uri]) {
        $response = $this->json($method, $uri);

        expect($response->status())->toBe(401);
    }
});

it('carries both auth:sanctum and the administrator gate on every admin route', function () {
    foreach (Route::getRoutes() as $route) {
        if (! str_starts_with($route->uri(), 'api/admin/')) {
            continue;
        }

        // toContain takes VALUES, not a failure message — passing a message
        // as the second argument asserts the message itself is in the array.
        expect($route->gatherMiddleware())
            ->toContain('auth:sanctum')
            ->toContain('administrator')
            ->toContain('active');
    }
});

it('lets an Administrator through the same routes', function () {
    $token = $this->admin->createToken('spa')->plainTextToken;

    $this->asToken($token)
        ->getJson('/api/admin/users')->assertOk();

    $this->asToken($token)
        ->getJson('/api/admin/audit-logs')->assertOk();

    $this->asToken($token)
        ->getJson('/api/admin/settings')->assertOk();
});

it('denies a non-Administrator on the admin dashboard endpoint through the shared gate', function () {
    foreach ([$this->agent, $this->lead] as $user) {
        $token = $user->createToken('spa')->plainTextToken;

        $this->asToken($token)
            ->getJson('/api/dashboard/admin/summary')
            ->assertStatus(403);
    }
});

it('denies a deactivated Administrator — the active check runs before the role gate', function () {
    $token = $this->admin->createToken('spa')->plainTextToken;
    $this->admin->forceFill(['is_active' => false])->save();

    $this->asToken($token)
        ->getJson('/api/admin/users')
        ->assertStatus(401);
});
