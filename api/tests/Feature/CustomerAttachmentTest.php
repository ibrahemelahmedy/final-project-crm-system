<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\CustomerAttachment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('local');

    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->agentToken = $this->agent->createToken('spa')->plainTextToken;

    $this->otherAgent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->otherAgentToken = $this->otherAgent->createToken('spa')->plainTextToken;

    $this->lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $this->leadToken = $this->lead->createToken('spa')->plainTextToken;

    $this->customer = Customer::factory()->create();
    $this->otherCustomer = Customer::factory()->create();
});

it('accepts an allowed file within the size cap', function () {
    $file = UploadedFile::fake()->create('brief.pdf', 100, 'application/pdf');

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->post("/api/customers/{$this->customer->id}/attachments", ['file' => $file]);

    $response->assertCreated();

    $attachment = CustomerAttachment::first();
    Storage::disk('local')->assertExists($attachment->path);
});

it('rejects an oversized file with a message naming the limit in MB', function () {
    $file = UploadedFile::fake()->create('huge.pdf', 20000, 'application/pdf');

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->post("/api/customers/{$this->customer->id}/attachments", ['file' => $file]);

    $response->assertStatus(422);
    expect($response->json('errors.file.0'))->toContain('MB');
    expect($response->json('errors.file.0'))->not()->toContain('kilobytes');
});

it('rejects a disallowed type with a message listing the allowed types', function () {
    $file = UploadedFile::fake()->create('script.exe', 10, 'application/octet-stream');

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->post("/api/customers/{$this->customer->id}/attachments", ['file' => $file]);

    $response->assertStatus(422);
    expect($response->json('errors.file.0'))->toContain('PDF');
});

it('never uses the client filename as the storage path', function () {
    // The extension must stay in the allowed list for the request to pass
    // validation at all; the traversal attempt lives in the rest of the name.
    $file = UploadedFile::fake()->create('../../../.env.pdf', 10, 'application/pdf');

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->post("/api/customers/{$this->customer->id}/attachments", ['file' => $file]);

    $response->assertCreated();

    $attachment = CustomerAttachment::first();

    expect($attachment->path)->not()->toContain('..');
    expect($attachment->path)->not()->toContain('.env');
    expect($attachment->original_name)->toContain('.env');
});

it('refuses to download an attachment belonging to another customer', function () {
    $file = UploadedFile::fake()->create('brief.pdf', 10, 'application/pdf');
    $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->post("/api/customers/{$this->customer->id}/attachments", ['file' => $file]);

    $attachment = CustomerAttachment::first();

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->get("/api/customers/{$this->otherCustomer->id}/attachments/{$attachment->id}");

    $response->assertStatus(404);
});

it('lets the uploader delete their own attachment and an agent not delete someone else\'s', function () {
    $file = UploadedFile::fake()->create('brief.pdf', 10, 'application/pdf');
    $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->post("/api/customers/{$this->customer->id}/attachments", ['file' => $file]);

    $attachment = CustomerAttachment::first();

    $forbidden = $this->withHeader('Authorization', "Bearer {$this->otherAgentToken}")
        ->deleteJson("/api/customers/{$this->customer->id}/attachments/{$attachment->id}");
    $forbidden->assertStatus(403);

    $allowed = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->deleteJson("/api/customers/{$this->customer->id}/attachments/{$attachment->id}");
    $allowed->assertStatus(204);
});
