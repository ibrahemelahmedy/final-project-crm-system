<?php

namespace App\Console\Commands;

use App\Mail\CsatInvitationMail;
use App\Mail\PortalAccessCodeMail;
use App\Models\CsatSurvey;
use App\Services\CsatShareLink;
use Illuminate\Console\Command;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Story 23 (WIS-27), Decision 10 — the owner's one-command proof that real
 * delivery works. Modelled on AiSmokeCommand: it prints the resolved mailer,
 * from-address and locale BEFORE sending, so a MAIL_FROM_ADDRESS that Brevo
 * will reject with a 550 is visible without reading a stack trace.
 *
 * Auto-discovered from app/Console/Commands — this project has no
 * app/Console/Kernel.php and one must not be created.
 */
class MailTestCommand extends Command
{
    protected $signature = 'mail:test {recipient : the address to send to}
                            {--kind=portal : portal|csat|plain}
                            {--locale= : en|ar; defaults to config(app.locale)}';

    protected $description = 'Send one real email through the configured mailer and report what happened.';

    public function handle(): int
    {
        $recipient = (string) $this->argument('recipient');

        if (! filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            $this->error("Not a valid email address: {$recipient}");

            return self::FAILURE;
        }

        $kind = in_array($this->option('kind'), ['portal', 'csat', 'plain'], true)
            ? $this->option('kind')
            : 'portal';

        $locale = $this->option('locale') ?: (string) config('app.locale');
        $mailer = (string) config('mail.default');

        $this->info("mailer: {$mailer}");
        $this->info('from: '.config('mail.from.address').' ('.config('mail.from.name').')');

        if ($mailer === 'smtp') {
            $this->info('host: '.config('mail.mailers.smtp.host').':'.config('mail.mailers.smtp.port'));
        }

        $this->info("locale: {$locale}");
        $this->info("kind: {$kind}");
        $this->info("to: {$recipient}");

        if ($mailer === 'log') {
            $this->warn('mailer is `log`; this writes to storage/logs/laravel.log and sends nothing. Set MAIL_MAILER=smtp to test real delivery.');
        }

        $mailable = $kind === 'plain' ? null : $this->buildMailable($kind);

        if ($kind !== 'plain' && $mailable === null) {
            return self::FAILURE;
        }

        $previousLocale = App::getLocale();

        if ($this->option('locale')) {
            App::setLocale($locale);
        }

        try {
            if ($kind === 'plain') {
                Mail::raw('Wisal mail:test — if you can read this, the transport works.', function ($message) use ($recipient) {
                    $message->to($recipient)->subject('Wisal mail:test');
                });
            } else {
                Mail::to($recipient)->send($mailable);
            }
        } catch (Throwable $e) {
            $this->error('Send failed: '.$e::class.' — '.$e->getMessage());

            return self::FAILURE;
        } finally {
            App::setLocale($previousLocale);
        }

        $this->info('Sent. Check the inbox (and the spam folder).');

        return self::SUCCESS;
    }

    private function buildMailable(string $kind): ?Mailable
    {
        if ($kind === 'portal') {
            return new PortalAccessCodeMail('123456');
        }

        $survey = CsatSurvey::query()->latest('id')->with('ticket.customer')->first();

        if ($survey === null) {
            $this->error('No CSAT survey found. Run: php artisan migrate:fresh --seed');

            return null;
        }

        return new CsatInvitationMail($survey, app(CsatShareLink::class)->for($survey));
    }
}
