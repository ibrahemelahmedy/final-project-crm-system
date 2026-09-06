<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Integration;
use App\Models\User;
use App\Services\AuditTrail;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

const WIS19_KNOWN_SECRET = 'sk_test_ABCDEFGH12345678';

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

/**
 * Story 18 (WIS-19). The story's most important test: the stored secret must
 * appear in NO API response, NO audit row, and NO stored error string —
 * including on Configure for an already-connected integration.
 */
it('never returns, logs, or leaks the stored secret anywhere', function () {
    bindIntegrationTester(true);

    $save = $this->asUser($this->admin)->putJson('/api/admin/integrations/erp', [
        'endpoint_url' => 'https://api.example-erp.test/v1',
        'secret' => WIS19_KNOWN_SECRET,
    ])->assertOk();

    expect($save->json('data.secret_last_four'))->toBe('5678');
    assertNoSecretAnywhere($save->json());
    expect($save->json('data'))->not->toHaveKey('secret');

    $list = $this->asUser($this->admin)->getJson('/api/admin/integrations')->assertOk();
    assertNoSecretAnywhere($list->json());

    $test = $this->asUser($this->admin)->postJson('/api/admin/integrations/erp/test', [])->assertOk();
    assertNoSecretAnywhere($test->json());

    $auditLogs = $this->asUser($this->admin)->getJson('/api/admin/audit-logs')->assertOk();
    assertNoSecretAnywhere($auditLogs->json());

    $row = Integration::where('type', 'erp')->first();
    expect($row->last_error)->toBeNull();

    $auditRow = AuditLog::where('event', AuditTrail::INTEGRATION_CONNECTED)->first();
    expect(json_encode($auditRow->context))->not->toContain(WIS19_KNOWN_SECRET);
});

it('never leaks the secret through a failing test either', function () {
    bindIntegrationTester(false, 'integrations.error.unreachable');

    $this->asUser($this->admin)->putJson('/api/admin/integrations/erp', [
        'endpoint_url' => 'https://api.example-erp.test/v1',
        'secret' => WIS19_KNOWN_SECRET,
    ])->assertOk();

    $row = Integration::where('type', 'erp')->first();
    expect($row->last_error)->toBe('integrations.error.unreachable');
    expect($row->last_error)->not->toContain(WIS19_KNOWN_SECRET);

    $auditRow = AuditLog::where('event', AuditTrail::INTEGRATION_TEST_FAILED)->first();
    expect(json_encode($auditRow->context))->not->toContain(WIS19_KNOWN_SECRET);
});

function assertNoSecretAnywhere(array $payload): void
{
    $flat = json_encode($payload);
    expect($flat)->not->toContain(WIS19_KNOWN_SECRET);

    array_walk_recursive($payload, function ($value, $key) {
        expect($key)->not->toBe('secret');
    });
}
