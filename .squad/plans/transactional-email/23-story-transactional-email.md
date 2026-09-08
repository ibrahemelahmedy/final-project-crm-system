# Story 23 — Real Transactional Email: Brevo SMTP for Portal Codes and CSAT (Story: WIS-27)

Planned at **full** depth. Every path, line range and signature below was verified against the
working tree on 2026-09-09 (branch `main`, after WIS-26).

---

## Prerequisites

- **Story 17 completed** — [`../customer-portal/17-story-customer-portal.md`](../customer-portal/17-story-customer-portal.md).
  Owns `PortalCodeNotifier`, `MailPortalCodeNotifier`, `PortalAccess`, `PortalAccessCodeMail`,
  `resources/views/mail/portal-access-code.blade.php`, `lang/{en,ar}/portal.php`'s `mail.*` block.
  **Decision 4 (mail is the only OTP channel) and ADR-005 (a phone-only customer gets no code) both
  still hold.** This story changes the transport and the chrome, never the seam.
- **Story 13 completed** — [`../csat-collection/00-overview.md`](../csat-collection/00-overview.md).
  Owns `CsatSurvey`, `TicketResolutionObserver`, `CsatShareLink`, the signed `csat.show` /
  `csat.store` routes. **Its rollback invariant is the single hardest constraint in this story** —
  see Decision 4 and Edge Case 2.
- **Story 20 completed** — organization-settings (WIS-20). `App\Services\OrganizationBranding` is
  the only "brand" this repo has; it is what "branded template (logo)" resolves to.
- **Story 15 completed** — internationalization (WIS-11). `App\Http\Middleware\SetLocale`,
  `lang/{en,ar}`.
- **Story 22 completed** — [`../ai-provider-seam/22-story-ai-provider-seam.md`](../ai-provider-seam/22-story-ai-provider-seam.md).
  Not a code dependency; the **shape** precedent. Committed default that needs no account, empty
  keys in `.env.example`, one artisan command as the owner's discharge path, README anchors named
  rather than invented. `AiSmokeCommand.php` is the literal template for Task 7.
- **No Brevo account is required to complete this story.** Every test runs under `Mail::fake()` or
  `Mailable::render()`. The owner pastes SMTP credentials afterwards and discharges the two
  delivery criteria with one command.

---

## Story Goal

Make the application actually send its two customer-facing emails, keep local development
account-free, and give both emails a branded, bilingual, RTL-correct body.

1. **A portal access code arrives as a real email.** `POST /api/portal/access/request` already
   issues a code and calls `MailPortalCodeNotifier`; with `MAIL_MAILER=smtp` and Brevo credentials
   in `api/.env`, that mail leaves the building instead of landing in `storage/logs/laravel.log`.
2. **Resolving a ticket emails the customer a CSAT invitation.** This is **new**. The survey row and
   the signed feedback link already exist; nothing has ever mailed them. After this story, the link
   `CsatSurveyController::showForTicket` mints for an agent to copy by hand is also sent to the
   customer automatically, once per resolution cycle.
3. **Local dev is unchanged and needs no account.** `MAIL_MAILER=log` stays the committed default in
   `.env.example`; a developer who clones and runs sees the mail in the log exactly as today.
4. **Both emails share one branded layout.** Organisation logo and primary colour when set, a text
   wordmark when not; `dir="rtl"` and Arabic copy under `ar`, `dir="ltr"` under `en`; the 6-digit
   code stays LTR in both.
5. **`php artisan mail:test <recipient>` is the one-command proof.** It prints the live mailer, the
   resolved from-address and the locale, sends one message, and turns an SMTP failure into a clean
   console error.

**Not in scope** (restating the intake, because these are the tempting adjacent moves): no queue and
no `ShouldQueue`; no migration of any kind — in particular **no `customers.locale` column and no
`csat_surveys.invited_at`**; no inbound email; no Brevo webhooks, bounce handling or send log; no
third mailable; no SMS/WhatsApp notifier; no `web/` file touched; no new composer dependency.

---

## Context — Read These Files First

1. `api/config/mail.php` — **118 lines, stock Laravel.** `'default' => env('MAIL_MAILER', 'log')` at
   `:17`. The `smtp` mailer at `:40-50` already reads `MAIL_SCHEME`, `MAIL_HOST`, `MAIL_PORT`,
   `MAIL_USERNAME`, `MAIL_PASSWORD` and sets `'timeout' => null`. The global `from` block at
   `:113-116`. **Brevo needs no new mailer entry — the transport is `smtp`.**
2. `api/.env.example:52-59` — the 8-line `MAIL_*` block. `api/.env:52-59` is byte-identical and is
   **gitignored**; do not edit it in the commit, but do tell the owner what to paste.
3. `api/app/Services/PortalAccess.php:35-77` — `requestCode()`. The `DB::transaction` closure ends
   at `:71`; `$this->notifier->send($customer, $code, $normalized)` is at `:76`, **outside** it, with
   the comment at `:73-75` explaining why. **This ordering is load-bearing. Do not move that line.**
4. `api/app/Services/MailPortalCodeNotifier.php:18-29` — the whole class. `$customer->email === null`
   → `Log::warning(...)` + `return` at `:20-26`; `Mail::to($customer->email)->send(new
   PortalAccessCodeMail($code))` at `:28`. This is where Task 4's transport-failure guard goes.
5. `api/app/Mail/PortalAccessCodeMail.php` — 25 lines. `public function __construct(public readonly
   string $code)` at `:18`; `build(): self` at `:20-24` returning
   `$this->subject(__('portal.mail.subject'))->view('mail.portal-access-code')`. **The class name and
   the constructor signature are asserted by tests — keep both.**
6. `api/resources/views/mail/portal-access-code.blade.php` — **12 lines, the only Blade file in the
   repository.** Bare `<!doctype html><html><body style="…">`, five `<p>` tags, and
   `<span dir="ltr">{{ $code }}</span>` at `:7` (correct — a numeric code stays LTR in Arabic).
   Run `list_dir api/resources/views` to confirm: there is **no** `layouts/`, no `vendor/mail`,
   no published Laravel mail components.
7. `api/lang/en/portal.php:16-22` and `api/lang/ar/portal.php:16-22` — the `mail.*` block:
   `subject`, `greeting`, `code_intro`, `expiry`, `ignore`. **Both locales are already complete;
   this story adds no key to `portal.php`.**
8. `api/app/Observers/TicketResolutionObserver.php:23-69` — `updated()`; the
   `! $ticket->wasChanged('status')` early return at `:25-27`; the
   `$ticket->status !== TicketStatus::Resolved` return at `:29-31`; `createSurveyFor()` at `:36-69`;
   the outstanding-survey guard at `:46-48` (**a re-resolve while a survey is outstanding creates
   nothing — and must therefore send nothing**); the `QueryException` unique-violation swallow at
   `:60-68` (**a concurrent double-resolve lands here — it must not send a second email either**).
   The class docblock at `:10-20` states the transaction fact in as many words.
9. `api/app/Http/Controllers/TicketController.php:179-180` — `DB::transaction(function () … {
   $ticket->update($data); … })`, the single-ticket resolve. And `:211-241` — the same inside
   `bulk()`. **The observer runs inside both.**
10. `api/app/Http/Requests/BulkTicketActionRequest.php:19` — `'ids' => ['required', 'array',
    'min:1', 'max:100']`. One hundred resolves, one transaction, one `afterCommit` flush.
11. `api/app/Services/CsatShareLink.php:22-34` — `for(CsatSurvey $survey): string`.
    `URL::temporarySignedRoute('csat.show', $survey->expires_at, ['uuid' => $survey->uuid])` at
    `:24-28`, re-pointed at `FRONTEND_URL` + `/feedback/{uuid}` at `:31-33`. **The invitation email
    mints its URL through this service. Never rebuild the link.** Its docblock at `:17-18` warns
    that renaming `csat.show` / `csat.store` invalidates every outstanding link.
12. `api/app/Models/CsatSurvey.php` — `uuid` is the only public id (`uniqueIds()` `:39-42`,
    `getRouteKeyName()` `:44-47`); `ticket()` at `:49-52`; `expires_at` cast at `:32`; `state`
    accessor `:64-75`; `isOutstanding()` `:77-81`.
13. `api/app/Models/Ticket.php:70` — `public function customer(): BelongsTo`. `customers.email` is
    **nullable** (`api/database/migrations/*_create_customers_table.php`, the `$table->string('email')
    ->nullable()` line) — the same ADR-005 gap as the portal path.
14. `api/app/Services/OrganizationBranding.php:26-46` — `current(): array{primary_color, logo_path,
    logo_url, updated_at}`. `PRIMARY_COLOR_KEY` / `LOGO_PATH_KEY` at `:21-25`. **Every value is
    nullable and all of them are null on a fresh install and on the Vercel deployment.** It reads
    the `settings` table, so it needs a database connection.
15. `api/app/Console/Commands/AiSmokeCommand.php` — 74 lines. **The literal template for Task 7:**
    the `protected $signature` with options at `:23`, the `config()` precondition returning
    `self::FAILURE` at `:31-35`, the `$this->info(...)` block naming what was resolved at `:63-68`,
    the caught exception printed as `$this->error(...)` at `:57-61`. Its docblock at `:18-20`:
    **commands are auto-discovered from `app/Console/Commands`; this project has no
    `app/Console/Kernel.php` and one must not be created.**
16. `api/app/Providers/AppServiceProvider.php:50-52` (the `PortalCodeNotifier` bind) and `:113-114`
    (`Ticket::observe(TicketResolutionObserver::class)`).
17. `api/phpunit.xml:60-61` — `<env name="MAIL_MAILER" value="array"/>` and
    `<env name="QUEUE_CONNECTION" value="sync"/>`. **The suite already cannot send a real email**;
    `Mail::fake()` is for assertions, not for safety.
18. `api/tests/Feature/Portal/PortalAccessRequestTest.php` — 6 tests. `Mail::fake()` at `:12, :24,
    :39, :50, :61`; `Mail::assertSent(PortalAccessCodeMail::class, 1)` at `:20` and `:57`,
    `assertNothingSent()` at `:46`, `assertSent(…, 2)` at `:73`.
19. `api/tests/Feature/Csat/CsatCreationTest.php` — 4 tests; `it('leaves no survey when the
    resolving transaction rolls back')` at `:60`. **This is the test Task 5 must extend.**
20. Grep for `Mail::` across `api/app` — it returns **exactly one hit**,
    `MailPortalCodeNotifier.php:28`. Grep for `Notification` — `api/app/Notifications/` does not
    exist. **There is no CSAT mailer today**; the intake's correction to the tracker text is the
    accurate one.
21. `README.md:128-133` — the "**Turning AI Assist on.**" paragraph. Task 8's new paragraph sits
    directly after it and imitates its shape. `README.md:190` (Category 11 row, "no real
    WhatsApp/SMS/Email send-and-receive"), `README.md:766` (the same claim under Known gaps),
    `README.md:780-807` (**13. Deployment**), with the "**Environment**" bullet at `:790-793`.
22. `api/composer.json:8-14` — `php ^8.3`, `anthropic-ai/sdk`, `laravel/framework ^13.17`,
    `laravel/sanctum`, `laravel/tinker`. **Confirm before Task 1: nothing is added here.**

---

## Decisions

**1 — Brevo over plain SMTP, through the framework's existing `smtp` mailer. No new dependency.**
Laravel ships Symfony's ESMTP transport and `config/mail.php:40-50` already wires every knob Brevo
needs. Brevo's relay is `smtp-relay.brevo.com`, port `587` with STARTTLS (`465` for implicit TLS),
username = the account's SMTP login, password = a generated **SMTP key**, never the account
password. That is five `.env` lines. An API transport (`brevo/brevo-php`,
`symfony/brevo-mailer`) would be a second code path and a new runtime dependency for zero benefit at
300 mails/day. **Do not add a `brevo` entry to `config/mail.php`'s `mailers` array** — the transport
*is* `smtp`; naming it "brevo" would imply a driver that does not exist.

**2 — `MAIL_MAILER=log` stays the committed default.** `.env.example` keeps `log`; only the host,
port, username, password and from-address lines change (to empty, commented values). Done Criterion
3 is discharged by the fact that a fresh clone needs no account. **Never commit `smtp` as the
default** — it would make `composer setup` fail on a machine with no credentials.

**3 — One hand-written Blade layout, not a markdown mailable.** `->markdown()` pulls in Laravel's
mail component set, whose table-based layout hard-codes LTR and whose theme is a CSS file this repo
does not own and has never published (confirm: no `api/resources/views/vendor/`). A single
`resources/views/mail/layout.blade.php` with `<html lang="{{ $locale }}" dir="{{ $dir }}">` and
inline styles is smaller, RTL-correct by construction, and adds no vendor surface. Both mailables
`@extends` it.

**4 — The CSAT send is deferred with `DB::afterCommit()`, inside the observer.**
`TicketResolutionObserver::updated()` runs inside the resolving transaction
(`TicketController.php:179-180`, `:211-241`). A send placed directly in `createSurveyFor()` would
(a) email a customer about a resolution that then rolled back, breaking
`CsatCreationTest.php:60`'s intent, and (b) hold an open database transaction across an SMTP
round-trip. `DB::afterCommit(fn () => …)` runs the closure after the outermost commit and **not at
all on rollback**; outside any transaction it runs immediately. It is registered **only on the path
that actually created a survey** — after the `CsatSurvey::create()` call succeeds, never in the
`isOutstanding()` early-return branch at `:46-48` and never in the `QueryException` swallow at
`:60-68`. One created survey, one email.

**5 — The CSAT email is capped per request.** `POST /api/tickets/bulk` accepts 100 ids
(`BulkTicketActionRequest.php:19`) in one transaction; 100 sequential SMTP round-trips would be
minutes of wall clock and a guaranteed timeout on a serverless function. `config('mail.csat.max_per_request')`
(default **10**, env `MAIL_CSAT_MAX_PER_REQUEST`) bounds it: past the cap, the survey is still
created and a `Log::warning` records how many invitations were skipped. **Surveys are never
skipped — only emails.** An agent bulk-resolving 100 tickets is an operational action, not a
customer-notification event, and the agent-facing `share_url` remains available for every one of
them.

**6 — Recipient locale comes from `config('mail.customer_locale')`, not from the request.**
`customers` has no `locale` column (verified against the create-customers migration) and adding one
is out of scope. For the **portal code** path the request locale *is* the customer's own choice —
they are typing into the portal — so that path keeps using the ambient locale and passes nothing.
For the **CSAT** path the ambient locale is the *resolving agent's*, which is the wrong answer, so
`CsatInvitationMail` calls `->locale(config('mail.customer_locale'))` explicitly.
`MAIL_CUSTOMER_LOCALE` defaults to `config('app.locale')`. **This is a recorded compromise, not a
solution** — the real fix is a `customers.locale` column in a later story, and the config key's
comment must say so.

**7 — A transport failure never breaks the portal `202` contract.** `MailPortalCodeNotifier::send()`
wraps the `Mail::to(...)->send(...)` in `try { } catch (Throwable $e) { Log::error(...) }`. The code
row already exists (Decision: `PortalAccess.php:76` sends after commit), the controller answers
`202 {"sent": true, …}` for a matched and an unmatched identifier alike
(`PortalAccessController.php:28-33`), and letting an SMTP 550 escape would turn that into a `500`
**only for identifiers that matched a real customer** — an enumeration oracle, defeating
`PortalEnumerationTest`. Log the class and the message; **never log the code**. The CSAT send gets
the same guard for the same reason (a failed invitation must not 500 a successful resolve).

**8 — `PortalAccessCodeMail` keeps `build()`; `CsatInvitationMail` matches it.** `build()` is legacy
but supported in Laravel 13, and `PortalAccessCodeMail`'s class name and `public readonly string
$code` constructor are asserted in five places. Modernising to `envelope()`/`content()` buys nothing
and risks the assertions. **Consistency between the two mailables beats API fashion.**

**9 — Branding degrades silently.** `OrganizationBranding::current()` returns nulls on a fresh
install and on Vercel (the `public` disk is not persisted there). The layout renders a text wordmark
and a default accent (`#0F172A`, the colour already inline in
`portal-access-code.blade.php:3`) when `logo_url` / `primary_color` are null. Resolving branding
must **never** be the thing that throws inside a mail render, so the layout resolves it through a
`try`/`catch` in the mailable, not with a raw `app(...)` call in Blade.

**10 — `php artisan mail:test {recipient} {--kind=}` is the owner's discharge path.** Modelled on
`AiSmokeCommand`. It prints `mailer`, `from`, `locale` and `kind` **before** sending, so a
`MAIL_FROM_ADDRESS` that Brevo will reject with a 550 is visible without reading a stack trace.

---

## Backend Tasks

`web/` gets **zero** changes. `git diff --name-only` showing no path under `web/` is a verification
step (Verification 6).

### 1 — `api/config/mail.php`: two new keys, nothing else

**File: `api/config/mail.php`**

Leave `:17`, the whole `mailers` array (`:38-100`) and the `from` block (`:113-116`) **exactly as
they are**. Append two blocks after `from`, before the closing `];` at `:118`:

```php
    /*
    |--------------------------------------------------------------------------
    | Customer-Facing Locale (Story 23 / WIS-27, Decision 6)
    |--------------------------------------------------------------------------
    |
    | `customers` has no locale column, so a mail sent outside a customer's own
    | request — the CSAT invitation, fired when an AGENT resolves a ticket —
    | has no honest per-recipient locale to read. It renders in this one
    | instead. The portal access code does NOT use this: that mail is sent
    | inside the customer's own portal request, where App::getLocale() is
    | their own choice.
    |
    | The real fix is a `customers.locale` column. That is a later story.
    |
    */

    'customer_locale' => env('MAIL_CUSTOMER_LOCALE', env('APP_LOCALE', 'en')),

    /*
    |--------------------------------------------------------------------------
    | CSAT Invitation (Story 23 / WIS-27, Decision 5)
    |--------------------------------------------------------------------------
    |
    | POST /api/tickets/bulk resolves up to 100 tickets in ONE transaction and
    | every one of them mints a survey. Mail here is synchronous — there is no
    | queue worker in this repository — so an uncapped bulk resolve would put
    | 100 sequential SMTP round-trips inside one HTTP request. Past this cap
    | the survey is still created and the agent-facing share link still works;
    | only the email is skipped, and the skip is logged.
    |
    */

    'csat' => [
        'max_per_request' => (int) env('MAIL_CSAT_MAX_PER_REQUEST', 10),
    ],
```

Do **not** add a `brevo` mailer (Decision 1). Do **not** change `'default'`.

### 2 — Create the shared branded layout

**Create file: `api/resources/views/mail/layout.blade.php`**

Requirements, in order of importance:

- `<html lang="{{ $locale }}" dir="{{ $dir }}">`, where both come from the mailable's view data.
  `$dir` is `'rtl'` for `ar`, `'ltr'` otherwise.
- **Inline styles only.** No `<link>`, no `<style>` block that matters — mail clients strip both.
  Set `text-align: {{ $dir === 'rtl' ? 'right' : 'left' }}` on the body wrapper; do **not** rely on
  `dir` alone for alignment, Gmail's Arabic rendering does not.
- A header band coloured with `$primaryColor` (Decision 9's `#0F172A` fallback) carrying either
  `<img src="{{ $logoUrl }}" alt="{{ $appName }}" style="max-height:40px">` when `$logoUrl` is
  non-null, or `{{ $appName }}` as text when it is null. **Never emit an `<img>` with an empty
  `src`.**
- `@yield('content')` (or `{{ $slot }}` if the executor prefers a component; pick one and use it in
  both mailables) for the body.
- A footer with `{{ $appName }}` and nothing else. **No unsubscribe link** — these are
  transactional, not marketing, and a fake unsubscribe is worse than none.
- Table-based centring (`<table role="presentation" width="100%">`) with a `max-width:560px` inner
  cell. This is the one place where 1998 HTML is correct.
- Every user-visible string in the layout goes through `__()`. If the layout has no user-visible
  string beyond `$appName`, that is the better outcome.

**Rewrite: `api/resources/views/mail/portal-access-code.blade.php`** to extend the layout. Keep all
five existing `__('portal.mail.*')` keys and **keep `<span dir="ltr">{{ $code }}</span>`** —
currently at `:7`. Style the code block with the layout's `$primaryColor`. **Add no new lang key to
`portal.php`.**

**Create file: `api/resources/views/mail/csat-invitation.blade.php`** — greeting, one line naming
the ticket subject, a prominent `<a href="{{ $url }}">` button (a bordered table cell, not a styled
`<a>`, so Outlook renders it), the raw URL underneath as a plain-text fallback, and an expiry line.
The ticket subject is customer-authored text: render it with `{{ }}`, **never `{!! !!}`**.

### 3 — Language lines for the CSAT invitation

**Create file: `api/lang/en/mail.php`** and **`api/lang/ar/mail.php`**. Follow the shape of
`api/lang/en/ai.php` — a header comment naming the story, then a flat `return [...]`. Both files
must be created in the same commit with the same key set; a key present in one locale and absent in
the other is the failure mode this project has already fixed once (WIS-17).

Keys (English shown; write real Arabic, not transliteration — `lang/ar/portal.php:16-22` is the
register to match):

```php
'csat' => [
    'subject'   => 'How did we do? — :subject',
    'greeting'  => 'Hello :name,',
    'intro'     => 'Your support request has been resolved. Would you take a moment to tell us how it went?',
    'ticket'    => 'Request: :subject',
    'cta'       => 'Rate your experience',
    'fallback'  => 'If the button does not work, copy this link into your browser:',
    'expiry'    => 'This link works until :date.',
],
```

`:name`, `:subject` and `:date` are Laravel replacement placeholders. `:date` is formatted from
`$survey->expires_at` in the mailable, not in Blade.

### 4 — Guard the portal notifier against a transport failure

**File: `api/app/Services/MailPortalCodeNotifier.php`**

Keep the null-email guard at `:20-26` untouched. Wrap the send at `:28`:

```php
try {
    Mail::to($customer->email)->send(new PortalAccessCodeMail($code));
} catch (Throwable $e) {
    // The code row is already committed (PortalAccess::requestCode sends
    // AFTER the transaction, deliberately). Letting an SMTP 550 escape would
    // 500 the request for identifiers that matched a real customer and 202
    // for those that did not — an enumeration oracle. Log and swallow.
    // NEVER log $code.
    Log::error('Portal access code email failed to send.', [
        'customer_id' => $customer->id,
        'exception' => $e::class,
        'message' => $e->getMessage(),
    ]);
}
```

Add `use Throwable;`. **Do not touch `api/app/Services/PortalAccess.php` at all** — the send-after-
commit ordering at `:73-76` is correct and is the reason this guard is enough.

### 5 — Send the CSAT invitation after commit

**Create file: `api/app/Mail/CsatInvitationMail.php`**

```php
final class CsatInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly CsatSurvey $survey,
        public readonly string $url,
    ) {}

    public function build(): self
    {
        return $this->locale((string) config('mail.customer_locale'))
            ->subject(__('mail.csat.subject', ['subject' => $this->survey->ticket->subject]))
            ->view('mail.csat-invitation');
    }
}
```

- `->locale(...)` per Decision 6. It must be called on the mailable, not via `App::setLocale()` —
  the latter would leak into the agent's response.
- **No `implements ShouldQueue`.** There is no queue worker (`README.md:194`).
- `$url` is injected, not built — the mailable never touches `CsatShareLink`, so a test can render
  it with a fixed string.

**File: `api/app/Observers/TicketResolutionObserver.php`**

Change `createSurveyFor()` (`:36-69`) only. After `CsatSurvey::create([...])` at `:53-59` succeeds,
capture the returned model and register the send:

```php
$survey = CsatSurvey::create([...]);   // unchanged payload

$this->queueInvitation($survey);
```

`queueInvitation()` is a new private method:

```php
private function queueInvitation(CsatSurvey $survey): void
{
    $email = $survey->ticket?->customer?->email;

    if ($email === null) {
        return;   // ADR-005: a phone-only customer has no delivery channel.
    }

    if (++self::$sentThisRequest > (int) config('mail.csat.max_per_request')) {
        Log::warning('CSAT invitation skipped: per-request cap reached.', [
            'survey_id' => $survey->id,
            'cap' => (int) config('mail.csat.max_per_request'),
        ]);

        return;
    }

    DB::afterCommit(function () use ($survey, $email) {
        try {
            Mail::to($email)->send(new CsatInvitationMail(
                $survey,
                app(CsatShareLink::class)->for($survey),
            ));
        } catch (Throwable $e) {
            Log::error('CSAT invitation email failed to send.', [
                'survey_id' => $survey->id,
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);
        }
    });
}
```

Critical details, each of which a reviewer will check:

- **Placed only on the created-a-survey path.** Not in the `isOutstanding()` early return at
  `:46-48`, not in the `QueryException` catch at `:60-68`. A re-resolve and a concurrent
  double-resolve both send **nothing**.
- **`DB::afterCommit` is the whole point of Decision 4.** Outside a transaction it fires
  immediately; inside one it fires after the outermost commit and is discarded on rollback.
- `self::$sentThisRequest` is a `private static int $sentThisRequest = 0;` counter on the observer.
  It is per-process, which is per-request in PHP-FPM and per-command in artisan. **Reset it in the
  test helper**, or the cap test will contaminate its neighbours — see Test Plan B4.
- Loading `ticket.customer` costs two queries per resolve. Use
  `$survey->ticket()->with('customer')->first()` or `loadMissing('ticket.customer')`; do not
  `Ticket::with(...)->find()` a second time.
- Add `use App\Mail\CsatInvitationMail; use App\Services\CsatShareLink; use
  Illuminate\Support\Facades\DB; use Illuminate\Support\Facades\Log; use Throwable;`.
  `Illuminate\Database\QueryException` is already imported at `:8`.

### 6 — `.env.example`

**File: `api/.env.example`** — replace `:52-59` with:

```
# Story 23 (WIS-27) — transactional email.
# `log` is the COMMITTED DEFAULT and needs no account: mail lands in
# storage/logs/laravel.log. Staging/production set MAIL_MAILER=smtp and fill
# the four Brevo lines below.
#
# Brevo (free: 300 mails/day) — https://app.brevo.com/settings/keys/smtp
#   MAIL_HOST=smtp-relay.brevo.com
#   MAIL_PORT=587            (STARTTLS; use 465 with MAIL_SCHEME=smtps)
#   MAIL_USERNAME=<your Brevo SMTP login>
#   MAIL_PASSWORD=<an SMTP KEY, not your account password>
#
# MAIL_FROM_ADDRESS must be an address VERIFIED in Brevo, or every send is
# rejected with a 550 at delivery time. Verify it first.
MAIL_MAILER=log
MAIL_SCHEME=null
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS="no-reply@example.com"
MAIL_FROM_NAME="${APP_NAME}"

# Locale for mail sent outside a customer's own request (the CSAT invitation).
# `customers` has no locale column; see config/mail.php.
MAIL_CUSTOMER_LOCALE=en

# Max CSAT invitations sent per HTTP request. A bulk resolve of 100 tickets
# still creates 100 surveys; only the emails past this cap are skipped.
MAIL_CSAT_MAX_PER_REQUEST=10
```

`MAIL_USERNAME` / `MAIL_PASSWORD` go from the literal string `null` to **empty**, matching the
WIS-26 block at `.env.example:67-84`. **No credential, login, key or real address appears in any
committed file.**

Do not commit a change to `api/.env` (gitignored). Task 8's README paragraph is where the owner is
told what to paste there.

### 7 — `php artisan mail:test`

**Create file: `api/app/Console/Commands/MailTestCommand.php`**

Auto-discovered from `app/Console/Commands` — **do not create `app/Console/Kernel.php`**
(`AiSmokeCommand.php:18-20`).

```php
protected $signature = 'mail:test {recipient : the address to send to}
                        {--kind=portal : portal|csat|plain}
                        {--locale= : en|ar; defaults to config(app.locale)}';

protected $description = 'Send one real email through the configured mailer and report what happened.';
```

`handle(): int`:

1. Validate `recipient` with `filter_var(..., FILTER_VALIDATE_EMAIL)`; `$this->error(...)` +
   `self::FAILURE` if it fails.
2. **Print before sending** (this is Decision 10's whole value):
   `mailer: {config('mail.default')}`, `from: {config('mail.from.address')} ({config('mail.from.name')})`,
   `host: {config('mail.mailers.smtp.host')}:{port}` when the mailer is `smtp`,
   `locale: …`, `kind: …`, `to: …`.
3. Warn — not fail — when `config('mail.default') === 'log'`: "mailer is `log`; this writes to
   storage/logs/laravel.log and sends nothing. Set MAIL_MAILER=smtp to test real delivery."
   Still send, so the command is useful locally.
4. Build the mailable for the chosen kind:
   - `portal` → `new PortalAccessCodeMail('123456')`.
   - `csat` → the newest `CsatSurvey` (`CsatSurvey::query()->latest('id')->with('ticket.customer')->first()`);
     when none exists, `$this->error('No CSAT survey found. Run: php artisan migrate:fresh --seed')`
     + `self::FAILURE`, mirroring `AiSmokeCommand.php:42-46`. URL from `app(CsatShareLink::class)->for($survey)`.
   - `plain` → a one-line `Mail::raw()`; the fastest way to prove credentials without a template.
5. `App::setLocale()` around the send when `--locale` is given, restoring the previous value in a
   `finally`.
6. `try { Mail::to($recipient)->send($mailable); } catch (Throwable $e)` →
   `$this->error("Send failed: {$e::class} — {$e->getMessage()}")` + `self::FAILURE`. A Brevo 550
   arrives here and must read as one line, not a stack trace.
7. On success: `$this->info('Sent. Check the inbox (and the spam folder).')` + `self::SUCCESS`.

### 8 — Documentation

**File: `README.md`** — four edits, no new top-level section.

1. **After the "Turning AI Assist on." paragraph (`:128-133`)**, add "**Sending real email.**":
   out of the box mail goes to `storage/logs/laravel.log` and no account is needed; to send for
   real, create a free Brevo account, verify a sender address, generate an **SMTP key**, set
   `MAIL_MAILER=smtp` + `MAIL_HOST=smtp-relay.brevo.com` + `MAIL_PORT=587` + `MAIL_USERNAME` +
   `MAIL_PASSWORD` + `MAIL_FROM_ADDRESS` (the verified address) in `api/.env`, then
   `php artisan config:clear && php artisan mail:test you@example.com`. Name the two emails that
   exist: the portal access code and the CSAT invitation.
2. **In "13. Deployment", the "Environment" bullet (`:790-793`)**: add that the API also needs the
   `MAIL_*` block for real delivery, that the from-address must be verified with the provider, and
   that with `MAIL_MAILER` unset the deployment silently logs instead of sending.
3. **`README.md:190`** (Category 11 row): the phrase "no real WhatsApp/SMS/Email send-and-receive"
   is now half wrong. Change it to say outbound transactional email is live (Brevo SMTP) and that
   **inbound** email, WhatsApp and SMS are still not. **Do not delete the caveat.**
4. **`README.md:766`** (Known gaps, same claim): same correction, same restraint.

---

## Edge Cases & Failure Modes

1. **Customer has no email (portal).** `MailPortalCodeNotifier.php:20-26` already logs a warning and
   returns. Unchanged by this story; ADR-005 stands.
2. **Customer has no email (CSAT).** `queueInvitation()` returns before registering the callback
   (Task 5). The survey is still created and the agent's `share_url` still works. **A ticket can
   have a customer with a null email — `customers.email` is nullable — so this is a live path, not
   a theoretical one.**
3. **The resolving transaction rolls back.** `DB::afterCommit` discards the callback. Enforced by
   Decision 4 and asserted by extending `CsatCreationTest.php:60`.
4. **Re-resolving a ticket with an outstanding survey.** `TicketResolutionObserver.php:46-48`
   returns before `createSurveyFor()` reaches the create, so no callback is registered and **no
   second email is sent**. Asserted by extending `CsatCreationTest.php:33`.
5. **Two agents resolve concurrently.** The unique index fires a `QueryException` swallowed at
   `:60-68`. The callback is registered only after a *successful* create, so the loser sends
   nothing.
6. **Bulk resolve of 100 tickets.** `mail.csat.max_per_request` (default 10) caps the sends; the
   remainder are logged as skipped. Surveys are never skipped. See Decision 5.
7. **SMTP is unreachable / times out / returns 550 (unverified sender).** Both send sites catch
   `Throwable` and log (Tasks 4 and 5). The portal request still answers `202`; the resolve still
   answers `200`. **`config/mail.php:48` sets the smtp `timeout` to `null`, which means "use the
   PHP default socket timeout"** — a hung relay can therefore stall a request. Leave it as-is (out
   of scope), but the executor must note it in the commit message as a known exposure.
8. **`MAIL_FROM_ADDRESS` is not verified in Brevo.** Every send is rejected at delivery. `mail:test`
   prints the resolved from-address before sending (Task 7 step 2) so one command shows the
   mismatch. The README says to verify first (Task 8).
9. **Branding is unset (fresh install, and the Vercel deployment).** `logo_url` and `primary_color`
   are null; the layout renders a text wordmark and `#0F172A`. **No `<img src="">` may be emitted.**
   Decision 9.
10. **Branding lookup throws (no database, cached config, console context).**
    `OrganizationBranding::current()` queries `settings`. The mailable resolves it in a `try`/`catch`
    and falls back to the null branding; a mail render must never 500 on a settings lookup.
11. **Arabic rendering.** `dir="rtl"` plus an explicit `text-align: right` (Decision/Task 2) —
    Gmail does not honour `dir` alone for block alignment. The 6-digit code keeps
    `<span dir="ltr">`, as it does today at `portal-access-code.blade.php:7`. The signed CSAT URL
    contains `?expires=…&signature=…` and must sit inside an LTR span in the RTL body or the query
    string reorders visually on copy.
12. **A ticket subject containing HTML or an Arabic/English mix.** Rendered with `{{ }}`, escaped.
    It also lands in the **subject line** via `__('mail.csat.subject', ['subject' => …])` — a very
    long subject makes a very long email subject. Truncate to a sane length (`Str::limit($subject,
    60)`) in the mailable.
13. **`migrate:fresh --seed` must not send 64 emails.** `TicketScenarioSeeder` creates every ticket
    with its **final** status in one `create()` (`:137-142`) and creates `CsatSurvey` rows directly
    at `:486`; the observer listens on `updated` only (`:23-27`), so it never fires. The seeder's
    `->update(['created_at' => …])` at `:159` does not change `status`, so `wasChanged('status')` is
    false. **Verify this by running the seeder and checking the log** (Verification 5) — do not take
    it on trust.
14. **Locale leakage.** `CsatInvitationMail` uses `->locale()`, which Laravel scopes to the render.
    Using `App::setLocale()` in the observer instead would change the locale of the agent's own JSON
    response mid-request. **Do not do that.**
15. **The `sentThisRequest` counter in a long-lived process.** Under Octane or a queue worker the
    static would never reset. Neither runs in this repository, and the counter is documented as
    per-process. If the executor finds an existing reset hook, use it; otherwise leave the comment.

---

## Test Plan

The suite runs on local PostgreSQL (`api/phpunit.xml:53-58`) with `MAIL_MAILER=array` at `:60`, so
no test can send a real message even without `Mail::fake()`. Pest, `uses(RefreshDatabase::class)`
where the database is touched and **not** where it is not (the WIS-26 plan-review made this call
explicitly).

### A — `api/tests/Feature/Mail/MailTemplateRenderTest.php` (new)

Renders mailables directly; needs `RefreshDatabase` only for the CSAT cases (they build a survey).

1. `it('renders the portal code email in English with dir=ltr and the code intact')` —
   `(new PortalAccessCodeMail('123456'))->render()`; assert the string contains `dir="ltr"`,
   `lang="en"`, `123456`, and the English `portal.mail.code_intro` value.
2. `it('renders the portal code email in Arabic with dir=rtl and the code still LTR')` —
   `App::setLocale('ar')` first; assert `dir="rtl"`, `lang="ar"`, the Arabic `code_intro`, and that
   the substring `<span dir="ltr">123456</span>` (or equivalent) is present. **This is Done
   Criterion 4's proof for the portal template.**
3. `it('renders the CSAT invitation with the signed URL and the ticket subject')` — build a
   `CsatSurvey` via factory, render `new CsatInvitationMail($survey, 'https://example.test/feedback/x?expires=1&signature=a')`;
   assert the URL and the escaped subject appear.
4. `it('renders the CSAT invitation in Arabic regardless of the ambient locale')` —
   `config(['mail.customer_locale' => 'ar'])`, `App::setLocale('en')`, render; assert `dir="rtl"`
   and Arabic copy. **Decision 6's proof.**
5. `it('escapes a ticket subject containing HTML')` — subject `<b>x</b>`; assert `&lt;b&gt;` is
   present and `<b>x</b>` is not.
6. `it('renders a text wordmark and no empty image when branding is unset')` — assert the output
   contains neither `src=""` nor `<img`.
7. `it('renders the organisation logo and primary colour when branding is set')` — write the two
   `Setting` rows via `OrganizationBranding`, render, assert both values appear.
8. `it('does not restore Laravel default mail components')` — assert the rendered output contains
   none of the markdown-component markers (a cheap guard on Decision 3). Optional; drop it if it
   proves brittle.

### B — `api/tests/Feature/Csat/CsatInvitationMailTest.php` (new)

`uses(RefreshDatabase::class)`. Resolve tickets through the real endpoint (`PATCH
/api/tickets/{id}`), not by calling the observer, so the transaction is real.

1. `it('sends exactly one invitation to the customer when a ticket is resolved')` —
   `Mail::fake()`; resolve; `Mail::assertSent(CsatInvitationMail::class, 1)` and
   `assertSent(fn ($m) => $m->hasTo($customer->email))`.
2. `it('sends nothing when the ticket customer has no email')` — customer with `email => null`;
   assert a survey exists **and** `Mail::assertNothingSent()`. Edge Case 2.
3. `it('sends nothing on a re-resolve while the survey is outstanding')` — resolve, reopen, resolve
   again; `Mail::assertSent(CsatInvitationMail::class, 1)`. Edge Case 4.
4. `it('stops sending past the per-request cap but still creates every survey')` —
   `config(['mail.csat.max_per_request' => 2])`; bulk-resolve 5 tickets via `POST /api/tickets/bulk`;
   assert 5 surveys and `Mail::assertSent(CsatInvitationMail::class, 2)`. **The observer's static
   counter must be reset in this test's `beforeEach`** — expose a `resetInvitationCounter()` static
   on the observer, or reset it reflectively; whichever the executor picks, the same mechanism must
   be used in every test in this file or the counts will drift. Edge Case 6 / Decision 5.
5. `it('carries the same signed link the agent-facing endpoint mints')` — capture the mailable, and
   assert its `url` matches `app(CsatShareLink::class)->for($survey)` modulo the `expires`/
   `signature` params (they are regenerated per call, so compare the path and `uuid`, not the whole
   string).
6. `it('does not fail the resolve when the transport throws')` — bind a mailer that throws (or
   `Mail::shouldReceive`), resolve, assert `200` and that the survey exists. Edge Case 7.

### C — `api/tests/Feature/Csat/CsatCreationTest.php` (modify — do not rewrite)

7. Extend the existing `it('leaves no survey when the resolving transaction rolls back')` at `:60`:
   add `Mail::fake()` at the top and `Mail::assertNothingSent()` at the bottom. **This one assertion
   is the proof of Decision 4** and the reason the whole `DB::afterCommit` design exists.
8. Add `Mail::fake()` to the other three tests in the file so their intent stays "survey rows", not
   "survey rows plus whatever mail did".

### D — `api/tests/Feature/Portal/PortalAccessRequestTest.php` (modify — do not rewrite)

9. Add `it('still answers 202 when the mail transport throws')` — bind a throwing mailer, request a
   code for a matching email, assert `202` **and** that the `PortalAccessCode` row exists.
   Decision 7 / Edge Case 7. **Every existing assertion in this file
   (`:20, :46, :57, :73`) must stay green and unmodified.**

### E — `api/tests/Feature/Console/MailTestCommandTest.php` (new)

10. `it('fails on an invalid recipient')` — `artisan('mail:test', ['recipient' => 'nope'])
    ->assertExitCode(Command::FAILURE)`.
11. `it('sends one portal-kind mail and reports the mailer')` — `Mail::fake()`;
    `artisan('mail:test', ['recipient' => 'a@b.test'])->assertExitCode(Command::SUCCESS)`;
    `Mail::assertSent(PortalAccessCodeMail::class, 1)`.
12. `it('fails cleanly when csat kind finds no survey')` — empty database; `--kind=csat`;
    assert `FAILURE` and no exception escapes. Mirrors `AiSmokeCommand.php:42-46`.
13. `it('warns when the mailer is log')` — `config(['mail.default' => 'log'])`; assert the output
    contains the warning **and** the exit code is still `SUCCESS`.

### F — Regression (no new file)

14. `api/tests/Feature/Portal/{PortalEnumerationTest,PortalRateLimitTest,PortalCsatCoexistenceTest}.php`
    and `api/tests/Feature/Csat/{CsatAuthorizationTest,CsatLinkSecurityTest,CsatPublicResponseTest,CsatReportsAggregateTest}.php`
    must pass **unchanged**. Any of them that resolves a ticket now also registers a send; with
    `MAIL_MAILER=array` that is harmless, but if one starts failing on a count, add `Mail::fake()`
    to it rather than changing production code.
15. `api/tests/Feature/Seeding/SeededDataRealismTest.php` must pass unchanged (Edge Case 13).
16. Full API suite green; the run before this story is **533 pass / 2,609 assertions**.

---

## Migration / Rollback

**No database migration.** No column, no table, no index. Nothing to roll back in the schema.

The only stateful change is configuration:

- **Rollback is one line**: `MAIL_MAILER=log` in `api/.env` (or unsetting it — `config/mail.php:17`
  defaults to `log`) stops every send immediately, with no code change and no redeploy of the
  templates. That is the intended kill switch and should be named as such in the commit message.
- **Half-applied state to watch for**: `MAIL_MAILER=smtp` with an unverified `MAIL_FROM_ADDRESS`.
  Portal codes are then **issued but never delivered** — the row exists (`PortalAccess.php:55-71`),
  the customer waits for a code that will never arrive, and the only evidence is a `Log::error`
  from Task 4. `php artisan mail:test <you>` is the one-command diagnosis; the README must say so.
- **`php artisan config:clear` is mandatory after editing `api/.env`.** A cached config
  (`bootstrap/cache/config.php`) keeps the old `MAIL_MAILER` and the change appears to do nothing.

---

## Verification Steps

1. **Backend tests:** `cd api && php artisan test` — expect **533 + the new tests** passing, zero
   failures. Then `php artisan test --filter=Mail` and `--filter=Csat` for the two focused runs.
2. **Formatting:** `cd api && ./vendor/bin/pint --test app/Mail app/Console/Commands app/Observers app/Services config`
   — clean on touched paths. (Repo-wide `pint --test` is dirty on ~30 pre-existing files; that is
   not this story's problem, per the WIS-25 run log.)
3. **Config integrity:** `cd api && php artisan config:cache && php artisan config:clear` — both
   exit `0`. A `config/mail.php` that throws would break every console command.
4. **Local default unchanged:** with a stock `.env.example`-derived `.env`,
   `php artisan mail:test you@example.com` prints `mailer: log`, warns, exits `0`, and the message
   body appears in `storage/logs/laravel.log`. **Done Criterion 3.**
5. **Seeder sends nothing:** `php artisan migrate:fresh --seed`, then confirm
   `storage/logs/laravel.log` gained **no** `CsatInvitationMail` entry. **Edge Case 13.**
6. **No frontend drift:** `git diff --name-only` lists zero paths under `web/`, and
   `api/composer.json` is unchanged. **Decision 1 and the intake's Out of scope.**
7. **No secret committed:** `git grep -nE "brevo|smtp-relay|MAIL_PASSWORD=." -- ':!*.md'` returns
   only the commented `.env.example` block and `config/mail.php`'s stock keys — **no value**.
   **Done Criterion 5.**
8. **RTL by eye, not only by assertion:** in `php artisan tinker`,
   `App::setLocale('ar'); file_put_contents(storage_path('ar.html'), (new
   App\Mail\PortalAccessCodeMail('123456'))->render());` then open `storage/ar.html` in a browser.
   Repeat for `en` and for `CsatInvitationMail`. **Done Criterion 4** — four files, checked visually.
9. **Owner-only, after pasting Brevo credentials into `api/.env` and running `config:clear`:**
   - `php artisan mail:test you@example.com --kind=plain` → an email arrives. Credentials are good.
   - `php artisan mail:test you@example.com --kind=portal --locale=ar` → the branded Arabic code
     email arrives. **Done Criterion 1's delivery half.**
   - `php artisan mail:test you@example.com --kind=csat` → the branded invitation arrives with a
     working link. **Done Criterion 2's delivery half.**
   - End to end: set a seeded customer's email to the owner's address, request a portal code from
     the SPA, and resolve one of that customer's tickets. Two real emails.

---

## Done Criteria

Code-verifiable (dischargeable in this story, with no Brevo account):

- [ ] `MAIL_MAILER=log` remains the committed default in `api/.env.example`; a fresh clone sends
      nothing, needs no account, and `mail:test` warns and still exits `0`. *(Jira criterion 3.)*
- [ ] Both templates render with `dir="rtl"` + `lang="ar"` under `ar` and `dir="ltr"` + `lang="en"`
      under `en`; the 6-digit code stays inside an LTR span in both. *(Jira criterion 4, by test.)*
- [ ] No credential, SMTP key, login or real address appears in any committed file;
      `git grep` (Verification 7) is clean. *(Jira criterion 5.)*
- [ ] A portal code request sends exactly one `PortalAccessCodeMail` whose rendered body contains
      the 6-digit code. *(Jira criterion 1, code half.)*
- [ ] Resolving a ticket sends exactly one `CsatInvitationMail` to the ticket's customer, carrying
      the signed feedback URL. *(Jira criterion 2, code half.)*
- [ ] A rolled-back resolve sends nothing (`CsatCreationTest.php:60` + `Mail::assertNothingSent()`).
- [ ] A re-resolve while a survey is outstanding, and a concurrent double-resolve, each send zero
      additional emails.
- [ ] A customer with a null email gets no email on either path, and neither request errors.
- [ ] A transport failure logs and does not change the portal `202` or the resolve `200`.
- [ ] A bulk resolve past `mail.csat.max_per_request` still creates every survey and logs the skips.
- [ ] `php artisan mail:test` exists, prints the mailer / from-address / locale before sending, and
      reports an SMTP failure as one console line.
- [ ] `README.md` documents the Brevo setup under "1. Run it in 60 seconds" and under
      "13. Deployment", and the two "no real Email send-and-receive" claims (`:190`, `:766`) are
      corrected to say **outbound is live, inbound is not**.
- [ ] `api/composer.json` is unchanged and `git diff --name-only` shows zero `web/` paths.
- [ ] The full API suite is green (533 + new).

Owner-verifiable (need the Brevo account; leave unticked until the owner reports):

- [ ] Requesting a portal code delivers a real email with the 6-digit code. *(Jira criterion 1,
      delivery half — `php artisan mail:test <you> --kind=portal`, then the real portal flow.)*
- [ ] Resolving a ticket delivers the CSAT invitation email. *(Jira criterion 2, delivery half —
      `php artisan mail:test <you> --kind=csat`, then a real resolve.)*

**STOP HERE. Report to the user and wait for confirmation before proceeding to WIS-23.**
