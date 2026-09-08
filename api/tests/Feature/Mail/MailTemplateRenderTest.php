<?php

use App\Mail\CsatInvitationMail;
use App\Mail\PortalAccessCodeMail;
use App\Models\CsatSurvey;
use App\Models\Setting;
use App\Models\Ticket;
use App\Services\OrganizationBranding;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\App;

uses(RefreshDatabase::class);

function renderTestSurvey(array $ticket = []): CsatSurvey
{
    $t = Ticket::factory()->create($ticket + ['subject' => 'Export finishes but the file is empty']);

    return CsatSurvey::factory()->create(['ticket_id' => $t->id]);
}

it('renders the portal code email in English with dir=ltr and the code intact', function () {
    App::setLocale('en');
    $html = (new PortalAccessCodeMail('123456'))->render();

    expect($html)->toContain('dir="ltr"')
        ->toContain('lang="en"')
        ->toContain('123456')
        ->toContain(__('portal.mail.code_intro', [], 'en'));
});

it('renders the portal code email in Arabic with dir=rtl and the code still LTR', function () {
    App::setLocale('ar');
    $html = (new PortalAccessCodeMail('123456'))->render();

    expect($html)->toContain('dir="rtl"')
        ->toContain('lang="ar"')
        ->toContain(__('portal.mail.code_intro', [], 'ar'))
        ->toContain('<span dir="ltr">123456</span>');
});

it('renders the CSAT invitation with the signed URL and the ticket subject', function () {
    $survey = renderTestSurvey();
    $url = 'https://example.test/feedback/x?expires=1&signature=a';

    $html = (new CsatInvitationMail($survey, $url))->render();

    expect($html)->toContain(e($url))
        ->toContain('feedback/x')
        ->toContain('Export finishes but the file is empty');
});

it('renders the CSAT invitation in Arabic regardless of the ambient locale', function () {
    config(['mail.customer_locale' => 'ar']);
    App::setLocale('en');
    $survey = renderTestSurvey();

    $html = (new CsatInvitationMail($survey, 'https://example.test/feedback/x?e=1'))->render();

    expect($html)->toContain('dir="rtl"')
        ->toContain(__('mail.csat.intro', [], 'ar'));
});

it('escapes a ticket subject containing HTML', function () {
    $survey = renderTestSurvey(['subject' => '<b>x</b>']);

    $html = (new CsatInvitationMail($survey, 'https://example.test/feedback/x?e=1'))->render();

    expect($html)->toContain('&lt;b&gt;x&lt;/b&gt;')
        ->not->toContain('<b>x</b>');
});

it('renders a text wordmark and no empty image when branding is unset', function () {
    App::setLocale('en');
    $html = (new PortalAccessCodeMail('123456'))->render();

    expect($html)->not->toContain('src=""')
        ->not->toContain('<img');
});

it('renders the organisation logo and primary colour when branding is set', function () {
    Setting::query()->create([
        'key' => OrganizationBranding::PRIMARY_COLOR_KEY,
        'value' => ['value' => '#123456'],
    ]);
    Setting::query()->create([
        'key' => OrganizationBranding::LOGO_PATH_KEY,
        'value' => ['value' => 'branding/logo.png'],
    ]);

    $html = (new PortalAccessCodeMail('123456'))->render();

    expect($html)->toContain('#123456')
        ->toContain('<img')
        ->toContain('branding/logo.png');
});
