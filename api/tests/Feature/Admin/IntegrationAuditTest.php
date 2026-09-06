<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditTrail;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

it('writes integration.connected on the first save, integration.updated on the second', function () {
    bindIntegrationTester(true);

    $this->asUser($this->admin)->putJson('/api/admin/integrations/erp', [
        'endpoint_url' => 'https://api.example-erp.test/v1',
        'secret' => 'sk_test_ABCDEFGH12345678',
    ])->assertOk();

    expect(AuditLog::where('event', AuditTrail::INTEGRATION_CONNECTED)->count())->toBe(1);

    $this->asUser($this->admin)->putJson('/api/admin/integrations/erp', [
        'endpoint_url' => 'https://api.example-erp.test/v2',
    ])->assertOk();

    expect(AuditLog::where('event', AuditTrail::INTEGRATION_UPDATED)->count())->toBe(1);
});

it('writes integration.test_failed — not connected/updated — when a save fails its test', function () {
    bindIntegrationTester(false, 'integrations.error.unreachable');

    $this->asUser($this->admin)->putJson('/api/admin/integrations/erp', [
        'endpoint_url' => 'https://api.example-erp.test/v1',
        'secret' => 'sk_test_ABCDEFGH12345678',
    ])->assertOk();

    expect(AuditLog::where('event', AuditTrail::INTEGRATION_TEST_FAILED)->count())->toBe(1);
    expect(AuditLog::where('event', AuditTrail::INTEGRATION_CONNECTED)->exists())->toBeFalse();
});

it('registers every INTEGRATION_* constant in both events() and label()', function () {
    $constants = [
        AuditTrail::INTEGRATION_CONNECTED,
        AuditTrail::INTEGRATION_UPDATED,
        AuditTrail::INTEGRATION_DISCONNECTED,
        AuditTrail::INTEGRATION_TEST_FAILED,
    ];

    foreach ($constants as $event) {
        expect(AuditTrail::events())->toContain($event);
        // A non-identity label — if a constant were missing from the match(),
        // AuditTrail::label() falls through to `default => $event`, which
        // this rejects.
        expect(AuditTrail::label($event))->not->toBe($event);
    }
});
