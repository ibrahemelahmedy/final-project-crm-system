<?php

use App\Models\Customer;
use App\Models\QuickReply;
use App\Models\Ticket;
use App\Models\User;
use App\Services\QuickReplyRenderer;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->renderer = new QuickReplyRenderer;
    $this->agent = User::factory()->create(['name' => 'Sarah Ahmed']);
});

it('resolves every placeholder in the vocabulary', function () {
    $customer = Customer::factory()->create(['name' => 'Nadia Karim']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'subject' => 'Payment issue']);
    $quickReply = QuickReply::factory()->create([
        'body' => 'Hi {{customer.first_name}} ({{customer.full_name}}), re ticket {{ticket.id}} "{{ticket.subject}}" — {{agent.first_name}} here.',
    ]);

    $rendered = $this->renderer->render($quickReply, $ticket, $this->agent);

    expect($rendered)->toBe(
        "Hi Nadia (Nadia Karim), re ticket {$ticket->id} \"Payment issue\" — Sarah here."
    );
});

it('echoes an unresolvable placeholder literally instead of an empty string', function () {
    // A soft-deleted customer is excluded from the default relation query —
    // $ticket->customer resolves to null, exactly like "no linked customer".
    $customer = Customer::factory()->create();
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id]);
    $customer->delete();
    $ticket->refresh();

    $quickReply = QuickReply::factory()->create(['body' => 'Hello {{customer.first_name}},']);

    $rendered = $this->renderer->render($quickReply, $ticket, $this->agent);

    expect($rendered)->toBe('Hello {{customer.first_name}},')
        ->and($rendered)->not->toContain('Hello ,');
});

it('does not re-substitute a customer name that itself contains {{', function () {
    $customer = Customer::factory()->create(['name' => '{{ticket.id}} Corp']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id]);
    $quickReply = QuickReply::factory()->create(['body' => 'Hi {{customer.full_name}}!']);

    $rendered = $this->renderer->render($quickReply, $ticket, $this->agent);

    // The literal "{{ticket.id}}" text that came FROM the customer's name is
    // never scanned again — it must survive verbatim, not resolve to the id.
    expect($rendered)->toBe('Hi {{ticket.id}} Corp!');
});

it('returns a template with no placeholders unchanged', function () {
    $ticket = Ticket::factory()->create();
    $quickReply = QuickReply::factory()->create(['body' => 'Thanks for your patience.']);

    expect($this->renderer->render($quickReply, $ticket, $this->agent))
        ->toBe('Thanks for your patience.');
});
