<?php

use App\Models\Customer;
use App\Models\PortalSession;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns 404, not 403, for another customer ticket', function () {
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('mine-token')->create();

    $otherTicket = Ticket::factory()->create();

    $show = $this->asToken('mine-token')->getJson("/api/portal/requests/{$otherTicket->id}")->assertStatus(404);
    $reply = $this->asToken('mine-token')
        ->postJson("/api/portal/requests/{$otherTicket->id}/messages", ['body' => 'hi'])
        ->assertStatus(404);

    $nonExistent = $this->asToken('mine-token')->getJson('/api/portal/requests/999999')->assertStatus(404);

    // Indistinguishable: a wrong-owner id and an unknown id must produce the
    // same status and the same body. (Debug-only keys — file/line/trace — are
    // stripped: they legitimately point at the different call sites in this
    // test and never reach a production response, where APP_DEBUG is false.)
    $strip = fn (array $j) => collect($j)->except(['file', 'line', 'trace'])->all();

    expect($show->status())->toBe($nonExistent->status())
        ->and($strip($show->json()))->toBe($strip($nonExistent->json()));
});
