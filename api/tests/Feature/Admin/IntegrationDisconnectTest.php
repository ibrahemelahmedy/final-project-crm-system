<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Integration;
use App\Models\User;
use App\Services\AuditTrail;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

it('deletes the row and returns 204', function () {
    Integration::factory()->create(['type' => 'erp']);

    $this->asUser($this->admin)->deleteJson('/api/admin/integrations/erp')->assertStatus(204);

    expect(Integration::where('type', 'erp')->exists())->toBeFalse();
});

it('is idempotent — deleting a type with no row is also 204', function () {
    $this->asUser($this->admin)->deleteJson('/api/admin/integrations/erp')->assertStatus(204);
    $this->asUser($this->admin)->deleteJson('/api/admin/integrations/erp')->assertStatus(204);
});

it('writes an INTEGRATION_DISCONNECTED audit row naming the type', function () {
    Integration::factory()->create(['type' => 'erp']);

    $this->asUser($this->admin)->deleteJson('/api/admin/integrations/erp')->assertStatus(204);

    $row = AuditLog::where('event', AuditTrail::INTEGRATION_DISCONNECTED)->first();

    expect($row)->not->toBeNull();
    expect($row->context['target_type'])->toBe('integration');
    expect($row->context['target_id'])->toBe('erp');
});

it('never writes an audit row when there was nothing to disconnect', function () {
    $this->asUser($this->admin)->deleteJson('/api/admin/integrations/erp')->assertStatus(204);

    expect(AuditLog::where('event', AuditTrail::INTEGRATION_DISCONNECTED)->exists())->toBeFalse();
});
