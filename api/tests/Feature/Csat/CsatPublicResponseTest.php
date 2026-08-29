<?php

use App\Models\CsatSurvey;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;

uses(RefreshDatabase::class);

function signedShow(CsatSurvey $survey): string
{
    return URL::temporarySignedRoute('csat.show', $survey->expires_at, ['uuid' => $survey->uuid]);
}

it('returns outstanding with only the ticket number and subject', function () {
    $ticket = Ticket::factory()->create(['subject' => 'Payment not going through']);
    $survey = CsatSurvey::factory()->for($ticket)->create();

    $res = $this->getJson(signedShow($survey))->assertOk();

    $res->assertJsonPath('state', 'outstanding')
        ->assertJsonPath('ticket.number', '#'.$ticket->id)
        ->assertJsonPath('ticket.subject', 'Payment not going through')
        ->assertJsonPath('rating', null);

    expect(array_keys($res->json('ticket')))->toBe(['number', 'subject']);
});

it('stores a rating and comment and sets responded_at', function () {
    $survey = CsatSurvey::factory()->create();

    $this->postJson(signedShow($survey), ['rating' => 4, 'comment' => 'Great help'])
        ->assertOk()
        ->assertJsonPath('state', 'answered')
        ->assertJsonPath('rating', 4)
        ->assertJsonPath('comment', 'Great help');

    $survey->refresh();
    expect($survey->rating)->toBe(4);
    expect($survey->responded_at)->not->toBeNull();
});

it('accepts a comment-less submission', function () {
    $survey = CsatSurvey::factory()->create();

    $this->postJson(signedShow($survey), ['rating' => 5])
        ->assertOk()
        ->assertJsonPath('state', 'answered')
        ->assertJsonPath('rating', 5);
});

it('never overwrites: a second submission returns the original rating', function () {
    $survey = CsatSurvey::factory()->create();

    $this->postJson(signedShow($survey), ['rating' => 2, 'comment' => 'first'])->assertOk();
    $this->postJson(signedShow($survey), ['rating' => 5, 'comment' => 'second'])
        ->assertOk()
        ->assertJsonPath('state', 'answered')
        ->assertJsonPath('rating', 2)
        ->assertJsonPath('comment', 'first');
});

it('rejects rating 0 and 6 with 422', function () {
    $survey = CsatSurvey::factory()->create();

    $this->postJson(signedShow($survey), ['rating' => 0])->assertStatus(422);
    $this->postJson(signedShow($survey), ['rating' => 6])->assertStatus(422);
});
