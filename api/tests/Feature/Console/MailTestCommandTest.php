<?php

use App\Mail\CsatInvitationMail;
use App\Mail\PortalAccessCodeMail;
use App\Models\CsatSurvey;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

it('fails on an invalid recipient', function () {
    $this->artisan('mail:test', ['recipient' => 'nope'])
        ->assertExitCode(1);
});

it('sends one portal-kind mail and reports the mailer', function () {
    Mail::fake();

    $this->artisan('mail:test', ['recipient' => 'a@b.test'])
        ->expectsOutputToContain('mailer:')
        ->assertExitCode(0);

    Mail::assertSent(PortalAccessCodeMail::class, 1);
});

it('sends a csat-kind mail when a survey exists', function () {
    Mail::fake();
    $ticket = Ticket::factory()->create();
    CsatSurvey::factory()->create(['ticket_id' => $ticket->id]);

    $this->artisan('mail:test', ['recipient' => 'a@b.test', '--kind' => 'csat'])
        ->assertExitCode(0);

    Mail::assertSent(CsatInvitationMail::class, 1);
});

it('fails cleanly when csat kind finds no survey', function () {
    Mail::fake();

    $this->artisan('mail:test', ['recipient' => 'a@b.test', '--kind' => 'csat'])
        ->expectsOutputToContain('No CSAT survey found')
        ->assertExitCode(1);
});

it('warns when the mailer is log but still exits 0', function () {
    Mail::fake();
    config(['mail.default' => 'log']);

    $this->artisan('mail:test', ['recipient' => 'a@b.test'])
        ->expectsOutputToContain('mailer is `log`')
        ->assertExitCode(0);
});
