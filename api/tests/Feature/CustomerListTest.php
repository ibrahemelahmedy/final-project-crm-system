<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->agentToken = $this->agent->createToken('spa')->plainTextToken;
});

it('paginates with a default page size of 25', function () {
    Customer::factory()->count(30)->create();

    $response = $this->asToken($this->agentToken)
        ->getJson('/api/customers');

    $response->assertOk()
        ->assertJsonCount(25, 'data')
        ->assertJsonPath('meta.total', 30);
});

it('filters by company and by tier', function () {
    Customer::factory()->create(['company' => 'Northwind Retail', 'tier' => 'enterprise']);
    Customer::factory()->create(['company' => 'Vertex Solutions', 'tier' => 'standard']);

    $response = $this->asToken($this->agentToken)
        ->getJson('/api/customers?'.http_build_query(['company' => ['Northwind Retail'], 'tier' => ['enterprise']]));

    $response->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonFragment(['company' => 'Northwind Retail']);
});

it('searches across name, email, and company', function () {
    Customer::factory()->create(['name' => 'Findable Person', 'company' => 'Acme']);
    Customer::factory()->create(['name' => 'Other Person', 'company' => 'Other Co']);

    $response = $this->asToken($this->agentToken)
        ->getJson('/api/customers?q=Findable');

    $response->assertOk()->assertJsonCount(1, 'data');
});

it('treats a percent sign in the search term literally', function () {
    Customer::factory()->create(['name' => 'Acme 100% Ltd']);
    Customer::factory()->create(['name' => 'Other']);

    $response = $this->asToken($this->agentToken)
        ->getJson('/api/customers?'.http_build_query(['q' => '100%']));

    $response->assertOk()->assertJsonCount(1, 'data');
});

it('keeps filters on the pagination links', function () {
    Customer::factory()->count(30)->create(['company' => 'Northwind Retail']);

    $response = $this->asToken($this->agentToken)
        ->getJson('/api/customers?'.http_build_query(['company' => ['Northwind Retail']]));

    $response->assertOk();
    expect($response->json('links.next'))->toContain('company');
});

it('rejects an unknown sort column', function () {
    $response = $this->asToken($this->agentToken)
        ->getJson('/api/customers?sort=password');

    $response->assertStatus(422);
});

it('returns facet counts computed over the filtered set, and all three tiers even at zero', function () {
    Customer::factory()->create(['company' => 'Northwind Retail', 'tier' => 'enterprise']);

    $response = $this->asToken($this->agentToken)
        ->getJson('/api/customers/facets');

    $response->assertOk();
    $tiers = collect($response->json('tiers'))->pluck('value');
    expect($tiers->sort()->values()->all())->toBe(['enterprise', 'premium', 'standard']);
});

it('returns zero for open_tickets_count while tickets has no customer_id', function () {
    Customer::factory()->create();

    $response = $this->asToken($this->agentToken)
        ->getJson('/api/customers');

    $response->assertOk()->assertJsonPath('data.0.open_tickets_count', 0);
});
