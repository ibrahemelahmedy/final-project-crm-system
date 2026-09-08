> **Fetched from jira:** [WIS-27](https://ibrahemelahmedy.atlassian.net/browse/WIS-27)  
> *Fetched 2026-09-08T23:20:19.519Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Wire a real transactional email provider (Brevo SMTP) for portal codes and CSAT  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Context

MAIL_MAILER=log in every environment, so no email is ever actually sent — portal access codes and CSAT invitations only land in storage/logs/laravel.log. MailPortalCodeNotifier and the CSAT mailer are already written and bound; only the transport is missing.

Goal

Real email delivery via a free transactional provider, with the log transport kept as the local default.

Scope

	Choose a free provider (Brevo — 300/day free; or Resend / MailerSend).

	.env SMTP (or API) keys; verify a sender domain / address.

	Local stays log; staging/production use the provider.

	A mail:test artisan command (or reuse php artisan tinker) to send one message and confirm delivery.

	README "Deployment" + "Run it" note the mail setup.

	Portal code email and CSAT email both use a branded template (logo, RTL-aware).

Done criteria

	Requesting a portal code delivers a real email with the 6-digit code.

	Resolving a ticket delivers the CSAT invitation email.

	Local dev still writes to the log with no provider account needed.

	Templates render correctly in Arabic (RTL) and English.

	Secrets are in env only, never committed.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/transactional-email/WIS-27/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Real Transactional Email — Brevo SMTP for Portal Codes and CSAT
- **Feature slug (folder under `plans/`):** `transactional-email`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-27` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Wire a real transactional email provider (Brevo SMTP) for portal codes and CSAT
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Context

MAIL_MAILER=log in every environment, so no email is ever actually sent — portal access codes and
CSAT invitations only land in storage/logs/laravel.log. MailPortalCodeNotifier and the CSAT mailer
are already written and bound; only the transport is missing.

Goal

Real email delivery via a free transactional provider, with the log transport kept as the local
default.

Scope

	Choose a free provider (Brevo — 300/day free; or Resend / MailerSend).
	.env SMTP (or API) keys; verify a sender domain / address.
	Local stays log; staging/production use the provider.
	A mail:test artisan command (or reuse php artisan tinker) to send one message and confirm delivery.
	README "Deployment" + "Run it" note the mail setup.
	Portal code email and CSAT email both use a branded template (logo, RTL-aware).

Done criteria

	[ ] Requesting a portal code delivers a real email with the 6-digit code.
	[ ] Resolving a ticket delivers the CSAT invitation email.
	[ ] Local dev still writes to the log with no provider account needed.
	[ ] Templates render correctly in Arabic (RTL) and English.
	[ ] Secrets are in env only, never committed.
```

**One correction to the tracker's Context, verified against the code at plan time.** The sentence
"MailPortalCodeNotifier **and the CSAT mailer** are already written and bound" is **half true**:

- `App\Services\MailPortalCodeNotifier` exists, is bound (`AppServiceProvider.php:52`) and sends
  `App\Mail\PortalAccessCodeMail` (`MailPortalCodeNotifier.php:28`). That half is real.
- **There is no CSAT mailer.** `api/app/Mail/` holds exactly one file, `PortalAccessCodeMail.php`;
  `api/app/Notifications/` does not exist; `grep -rn "Mail::" api/app` returns exactly one hit, the
  one above. The CSAT survey link is today minted only for the **agent** to copy by hand
  (`CsatSurveyController::showForTicket` → `share_url` via `App\Services\CsatShareLink`). Nothing
  ever emails a customer about a resolved ticket.

So this story is **not** "add a transport to two existing mailers". It is **one transport + one
layout + one new mailable + one new send-site + one new command**. The planner must size it that
way, and Done Criterion 2 is a *new feature*, not a re-wiring.

---

## Acceptance criteria

*(Copied verbatim from the Jira issue's "Done criteria" block. These five are the story's Done Criteria.)*

```
[ ] Requesting a portal code delivers a real email with the 6-digit code.
[ ] Resolving a ticket delivers the CSAT invitation email.
[ ] Local dev still writes to the log with no provider account needed.
[ ] Templates render correctly in Arabic (RTL) and English.
[ ] Secrets are in env only, never committed.
```

**Note for the planner — split these into code-verifiable and owner-verifiable, exactly as WIS-26
did.** The owner has no Brevo account at plan time and will paste `MAIL_USERNAME` /
`MAIL_PASSWORD` after the code lands.

- Criteria **3, 4, 5** are fully dischargeable **by test**, with no account: `Mail::fake()` +
  `Mailable::render()` + a `config('mail.default')` assertion + a `git`-visible `.env.example`.
- Criteria **1 and 2** split into a *code* half and a *delivery* half. The code half — "a portal
  code request queues exactly one `PortalAccessCodeMail` whose body contains the 6-digit code" and
  "resolving a ticket sends exactly one `CsatInvitationMail` to the ticket's customer, containing
  the signed feedback URL" — is dischargeable by test **today**. The *delivery* half ("a real email
  arrives in an inbox") needs the account and stays unticked until the owner runs the new command.
- The plan **must** ship a one-command discharge recipe for that last half, in the shape of
  WIS-26's `php artisan ai:smoke`: **`php artisan mail:test <recipient> [--kind=portal|csat|plain]`**.
  It must resolve everything from the container / real mailer, print the mailer name and the
  resolved from-address, and report an SMTP failure as a clean console error rather than a stack
  trace.

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| — | — |

None. Every fact this story needs is in the repository or in Brevo's public SMTP-relay
documentation (host `smtp-relay.brevo.com`, ports `587` STARTTLS / `465` implicit TLS, username =
the account's SMTP login, password = an SMTP **key**, not the account password). The file paths are
listed under **Technical hints** below.

---

## Dependencies

- **Blocked by / related ids:** none. The owner supplies a Brevo SMTP login + key **after** the code
  lands; the story is built and tested against `Mail::fake()` and `Mailable::render()`, so no
  account is needed to complete it.
- **Blocks:** nothing in the pipeline. WIS-27 is the small independent story between WIS-26 and
  WIS-23 (`.squad/pipeline.md`).
- **Depends on code areas or other stories:**
  - **Story 17 — customer-portal (WIS-16)**, `.squad/plans/customer-portal/17-story-customer-portal.md`.
    Owns `PortalCodeNotifier`, `MailPortalCodeNotifier`, `PortalAccess`, `PortalAccessCodeMail`,
    `resources/views/mail/portal-access-code.blade.php` and `lang/{en,ar}/portal.php`'s `mail.*`
    block. **Its Decision 4 (mail is the only OTP channel) and ADR-005 (a phone-only customer gets
    no code, and that is recorded, not faked) both still hold.** This story changes the *transport
    and the chrome*, not the seam.
  - **Story 13 — csat-collection (WIS-14)**, `.squad/plans/csat-collection/13-*.md`. Owns
    `CsatSurvey`, `CsatSurveyState`, `TicketResolutionObserver`, `CsatShareLink`,
    `CsatSurveyController` and the `csat.show` / `csat.store` signed routes. **The invariant that
    matters here: a survey is created *inside the resolving transaction* and a rolled-back resolve
    must leave no trace** (`tests/Feature/Csat/CsatCreationTest.php:60`). An email is not
    transactional — see **Extra notes**.
  - **Story 20 — organization-settings (WIS-20)**, for `App\Services\OrganizationBranding`. Its
    `current()` returns `primary_color`, `logo_path`, `logo_url` from the `settings` table. That is
    the only "brand" the repo has, and it is what "branded template (logo)" must resolve to — not a
    new asset, not a new setting.
  - **Story 15 — internationalization (WIS-11)**, for `App\Http\Middleware\SetLocale` and the
    `lang/{en,ar}` catalogues. Every user-visible string in both templates goes through `__()`.
  - **Story 22 — ai-provider-seam (WIS-26)**, `.squad/plans/ai-provider-seam/22-story-ai-provider-seam.md`,
    for the **shape** of this story, not its code: config-selected provider, committed default that
    needs no account, empty keys in `.env.example`, one `artisan` smoke command as the owner's
    discharge path, README anchors named explicitly rather than a new section invented.

## Extra notes (optional)

Facts verified against the working tree on 2026-09-09. The planner should re-check any it depends
on, but these are the ones that decide the design.

1. **No new composer dependency.** `api/composer.json:8-14` is
   `php ^8.3`, `anthropic-ai/sdk`, `laravel/framework ^13.17`, `laravel/sanctum`, `laravel/tinker`.
   Laravel ships `symfony/mailer` + `symfony/mailer`'s ESMTP transport, and `config/mail.php:40-50`
   already defines a complete `smtp` mailer reading `MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` /
   `MAIL_PASSWORD` / `MAIL_SCHEME`. **Brevo over SMTP is env-only.** Do not add `brevo/brevo-php`,
   `symfony/brevo-mailer`, or any API SDK — an API transport would be a second code path for zero
   benefit at 300 mails/day.

2. **`config/mail.php` is stock Laravel and may stay almost stock.** The only changes it needs are
   (a) whatever key the story adds for the recipient locale (see 6) and (b) nothing else. Do **not**
   add a `brevo` entry to `mailers` — the transport *is* `smtp`.

3. **There is no queue worker.** `.env.example:40` says `QUEUE_CONNECTION=database`, but
   `README.md:194` states plainly that nothing drains the `jobs` table and the SLA engine is a
   scheduled command for exactly that reason. `PortalAccessCodeMail` uses the `Queueable` trait but
   is dispatched with `Mail::to(...)->send(...)`, i.e. **synchronously**. Both mailables in this
   story must stay synchronous: **no `implements ShouldQueue`, no `Mail::queue()`**. A queued mail
   in this repo is a mail that is never sent. The cost — an SMTP round-trip inside the request — is
   the accepted trade-off and belongs in the plan's Decisions, not discovered later.

4. **The portal-code send is deliberately AFTER the transaction commits** —
   `api/app/Services/PortalAccess.php:55-76`, with the comment "a delivery failure must not roll
   back an issued code and leave the customer holding one the database has never seen." **That
   ordering is load-bearing and must not be changed.** It also means a Brevo 5xx / timeout on the
   portal path throws *after* the code row exists; the controller currently answers `202
   {"sent": true}` regardless, and the enumeration-safety rule
   (`tests/Feature/Portal/PortalEnumerationTest.php`) says the response must be byte-identical
   whether or not a customer matched. The planner must decide **explicitly** whether a transport
   exception is (a) allowed to escape and 500 the request, or (b) caught and logged inside
   `MailPortalCodeNotifier` so the 202 contract survives. (b) is almost certainly right, and it
   preserves the existing `Log::warning` idiom already in that class at `:21`.

5. **The CSAT send site is the opposite case and is the real trap.**
   `App\Observers\TicketResolutionObserver::updated()` fires **inside** the resolving transaction —
   `TicketController::update()` wraps `$ticket->update($data)` in `DB::transaction` at
   `TicketController.php:179-180`, and `bulkUpdate` does the same at `:211-241`. Its own docblock
   says so, and `tests/Feature/Csat/CsatCreationTest.php:60` asserts a rolled-back resolve leaves no
   survey. **Sending mail from inside that closure would email a customer about a resolution that
   was then rolled back**, and would put an SMTP round-trip inside an open database transaction.
   The send must be deferred with `DB::afterCommit(...)` (or an equivalent) so it runs once, after
   commit, and not at all on rollback. The existing rollback test must be extended with
   `Mail::assertNothingSent()` — that assertion is the proof.
   **Bulk resolve is the multiplier:** `POST /api/tickets/bulk` (`routes/api.php:62`) accepts up to
   **100 ids** (`BulkTicketActionRequest.php:19`, `'ids' => [..., 'max:100']`) in **one**
   transaction, so `afterCommit` can fire up to 100 synchronous SMTP round-trips inside a single
   request — minutes of wall clock, and a certain timeout on Vercel's function limit. The plan must
   confront this number, not discover it: cap it, guard it, or state plainly why 100 sequential
   sends is acceptable.

6. **No customer has a locale.** `database/migrations/*_create_customers_table.php` has
   `name, email, phone, phone_normalized, company, tier, last_contact_at, created_by` — **no
   `locale` column, no `preferred_language`**. `SetLocale` derives `App::getLocale()` from the
   SPA's `Accept-Language`, which for the portal-code path *is* the customer's own choice (they are
   using the portal) but for the CSAT path is the **resolving agent's** locale, which is the wrong
   answer. The planner must choose one and record it as a Decision:
   - a new config key, e.g. `mail.customer_locale` from `MAIL_CUSTOMER_LOCALE` defaulting to
     `config('app.locale')`, passed via `Mailable::locale()`; **or**
   - a bilingual CSAT body.
   **No migration.** Adding `customers.locale` is out of scope (see below) — it is a real gap and
   should be recorded as such, not built here.

7. **The only existing template is 12 lines and has no branding, no RTL and no layout.**
   `api/resources/views/mail/portal-access-code.blade.php` is a bare `<html><body>` with inline
   styles and `<span dir="ltr">` around the code (correct — a 6-digit code must stay LTR even in an
   Arabic email). `api/resources/views/` contains **nothing else**; there is no `layouts/`, no
   `vendor/mail` (Laravel's markdown components have never been published). The story therefore
   creates the layout it needs. **Markdown mailables are a trap here**: `->markdown()` pulls in
   Laravel's published-or-default component set, whose table-based layout is LTR-hardcoded and
   whose theme is a CSS file this repo does not own. A single hand-written Blade layout
   (`resources/views/mail/layout.blade.php`) with `<html dir="{{ ... }}" lang="{{ ... }}">` and
   inline styles is smaller, RTL-correct, and has no vendor surface. The planner should choose it
   and say why.

8. **"Branded" resolves to `OrganizationBranding::current()`.** `primary_color` (a hex string or
   null) and `logo_url` (a `Storage::disk('public')->url($path)` or null). Both are nullable and
   **both are null on a fresh install and on the Vercel deployment** (`config/branding.php` disk is
   `public`; a serverless deploy has no persisted public disk). The layout must therefore degrade
   to a text wordmark and a default accent with no broken-image icon — resolving branding must
   never be the thing that throws inside a mail render. It also hits the `settings` table, so the
   layout must not be rendered in a context with no database (the `mail:test` command has one; a
   config-cache pass does not render).

9. **Five test files already fake mail; none of them may break.**
   `tests/Feature/Portal/PortalAccessRequestTest.php` (6 tests, `Mail::fake()` + 4
   `Mail::assertSent(PortalAccessCodeMail::class, N)` / `assertNothingSent`),
   `PortalEnumerationTest.php`, `PortalRateLimitTest.php`, plus
   `tests/Feature/Auth/LoginTest.php` and `tests/Feature/I18n/LocalizedValidationTest.php` which
   only match the grep on the word "mail". **`PortalAccessCodeMail`'s class name, constructor
   signature (`public readonly string $code`) and the fact that it is `send`, not `queue`, are all
   asserted.** Keeping the class and changing only its `build()`/`content()` is the safe shape.

10. **`Mailable::build()` is the legacy API.** `PortalAccessCodeMail` uses
    `public function build(): self { return $this->subject(...)->view(...); }`. It still works in
    Laravel 13. The planner may modernise it to `envelope()` / `content()`, but must say so
    explicitly and must keep the constructor signature the tests rely on. Consistency between the
    two mailables matters more than which API wins.

11. **Sender verification is the owner's step and the most common failure.** Brevo rejects a `MAIL
    FROM` whose domain is not a verified sender or authenticated domain on the account, with a 550
    at send time — *after* the code has been issued (see 4). `MAIL_FROM_ADDRESS` is
    `hello@example.com` in both `.env` and `.env.example` today (`:58`), which **will** be rejected.
    The plan must (a) make `mail:test` print the resolved from-address before sending so the
    mismatch is visible in one command, and (b) put the "verify a sender in Brevo, then set
    `MAIL_FROM_ADDRESS` to that exact address" step in the README, not only in a code comment.

12. **Secrets.** `api/.env` is gitignored; `api/.env.example` is committed and currently carries
    `MAIL_USERNAME=null` / `MAIL_PASSWORD=null`. The WIS-26 precedent (`.env.example:67-84`) is an
    empty-valued, commented block. Follow it exactly. **No Brevo key, login, or `.env` value may
    appear in any committed file, in a test fixture, or in a plan file.** Done Criterion 5 is
    discharged by `git grep` finding nothing, and the plan should say which command proves it.

13. **The README has no mail section.** The two anchors named by the tracker exist and are the ones
    to edit: **"1. Run it in 60 seconds"** (`README.md:100-135`, where the "Turning AI Assist on."
    paragraph at `:128-133` is the exact precedent to imitate) and **"13. Deployment"**
    (`README.md:780-807`, the "**Environment**" bullet at `:790-793`). A third touch is defensible:
    the Category 11 "Integrations — Partial by design" row at `README.md:190` says "no real
    WhatsApp/SMS/**Email** send-and-receive", and `README.md:766` repeats it under Known gaps.
    Outbound transactional email is now real; inbound is still not. Whoever edits those two lines
    must keep them honest rather than deleting the caveat.

14. **`api/tests` runs on a local PostgreSQL** (`phpunit.xml`, and the note at `README.md:773`).
    Nothing in this story is SQL-shaped, but a test that renders a mailable touching
    `OrganizationBranding` needs `RefreshDatabase`. A pure `Mailable::render()` locale test does
    not — do not add the trait where it is not needed (WIS-26's plan-review made the same call).

15. **`web/` gets zero changes.** The SPA does not know an email exists. If the executor finds
    itself editing `web/`, the design is wrong. `git diff --name-only` showing no `web/` path is a
    verification step, as it was for WIS-26.

## Technical hints (optional)

Repos/roots: `.` (`api/` Laravel 13 + `web/` React 19). Files this story touches or reads:

**The transport and config**
- `api/config/mail.php` — 118 lines, stock. `default` = `env('MAIL_MAILER', 'log')` (`:17`); the
  `smtp` mailer at `:40-50`; the global `from` block at `:113-116`.
- `api/.env.example:52-59` and `api/.env:52-59` — the identical 8-line `MAIL_*` block to replace.
  `.env` is gitignored; only `.env.example` is committed.
- `api/composer.json:8-14` — confirm no new dependency is required.

**Portal code path (exists; gets a new template + a failure guard)**
- `api/app/Services/PortalAccess.php:35-77` — `requestCode()`. **`$this->notifier->send(...)` at
  `:76` is deliberately outside the `DB::transaction` closure that ends at `:71`.**
- `api/app/Services/PortalCodeNotifier.php` — the 17-line interface. Unchanged.
- `api/app/Services/MailPortalCodeNotifier.php:18-29` — the null-email `Log::warning` guard at
  `:20-26`, the send at `:28`. This is where a transport-failure catch would go.
- `api/app/Mail/PortalAccessCodeMail.php` — 25 lines, `build()`, `subject(__('portal.mail.subject'))`,
  `view('mail.portal-access-code')`.
- `api/resources/views/mail/portal-access-code.blade.php` — 12 lines, the only view in the repo.
- `api/lang/en/portal.php:16-22` and `api/lang/ar/portal.php:16-22` — the `mail.*` block:
  `subject`, `greeting`, `code_intro`, `expiry`, `ignore`. Both locales are already complete.
- `api/app/Providers/AppServiceProvider.php:50-52` — the `PortalCodeNotifier` bind.
- `api/app/Http/Controllers/Portal/PortalAccessController.php` — the `202 {"sent": true}` contract.

**CSAT path (the new mailable + the new send site)**
- `api/app/Observers/TicketResolutionObserver.php:23-69` — `updated()`, the `wasChanged('status')`
  guard at `:25`, `createSurveyFor()` at `:36-69`, the unique-violation swallow at `:60-68`
  (a concurrent double-resolve lands here — **it must not also send a second email**).
- `api/app/Services/CsatShareLink.php:22-34` — `for(CsatSurvey $survey): string`, a
  `URL::temporarySignedRoute('csat.show', $survey->expires_at, ['uuid' => ...])` re-pointed at
  `FRONTEND_URL` + `/feedback/{uuid}`. **This is the URL the invitation email must carry** — mint it
  through this service, never rebuild it.
- `api/app/Models/CsatSurvey.php` — `uuid` is the only public id (`:39-47`); `expires_at` is
  `now()->addDays(30)` (set in the observer at `:58`); `state` / `isOutstanding()` at `:64-81`.
- `api/app/Http/Controllers/CsatSurveyController.php:88-106` — `showForTicket`, the existing
  agent-facing `share_url`. The email is a second consumer of the same link, not a replacement.
- `api/app/Http/Controllers/TicketController.php:179-180` (single resolve) and `:211-241`
  (bulk) — the transactions the observer runs inside.
- `api/app/Models/Ticket.php` — for the `customer()` relation and `subject`; the invitation needs
  `$ticket->customer->email`, which is **nullable** (same gap as the portal path, ADR-005).
- There is **no** `api/lang/{en,ar}/csat.php`. A new catalogue file (or a `mail.*` block in a new
  shared `mail.php`) is part of this story; both locales must land together.

**Branding + locale**
- `api/app/Services/OrganizationBranding.php:26-46` — `current()` returning
  `primary_color`, `logo_path`, `logo_url`, `updated_at`. Nullable throughout.
- `api/config/branding.php` — disk `public`, and the comment explaining why.
- `api/app/Http/Middleware/SetLocale.php` — `SUPPORTED = ['en','ar']`, `Accept-Language`, fallback
  `en`.
- `api/lang/en/` and `api/lang/ar/` — seven files each today: `ai, auth, enums, passwords, portal,
  sla, validation`. Any new file must be added to **both**.

**Tests**
- `api/tests/Feature/Portal/PortalAccessRequestTest.php` — 6 tests, the `Mail::fake()` +
  `Mail::assertSent(PortalAccessCodeMail::class, N)` assertions at `:20, :46, :57, :73`.
- `api/tests/Feature/Portal/PortalEnumerationTest.php:10,24,31` and
  `PortalRateLimitTest.php:10,23` — `Mail::fake()` and `assertNothingSent`.
- `api/tests/Feature/Csat/CsatCreationTest.php` — 4 tests; **`:60` "leaves no survey when the
  resolving transaction rolls back"** is the one that must also assert no mail.
- `api/tests/Feature/Csat/{CsatAuthorizationTest,CsatLinkSecurityTest,CsatPublicResponseTest,CsatReportsAggregateTest}.php`
  and `api/tests/Feature/Portal/PortalCsatCoexistenceTest.php` — every other file that resolves a
  ticket. **Any of them that triggers a resolve will now trigger a send**; if they do not fake mail,
  a real `log` transport writes to the test log and they still pass — but the planner should say
  which ones need `Mail::fake()` added rather than leaving it to chance.
- `api/tests/Pest.php` — the shared helpers; check whether a resolve helper exists before writing a
  new one.
- `api/tests/Feature/Seeding/SeededDataRealismTest.php` and
  `api/database/seeders/TicketScenarioSeeder.php:124-159,486` — **the seeder creates every ticket
  with its final status in one `create()` and creates `CsatSurvey` rows directly (`:486`)**, so the
  `updated`-only observer never fires and `migrate:fresh --seed` must not send 12 emails. Confirm
  that, and consider whether the new send site needs an explicit guard anyway.

**The command and the docs**
- `api/app/Console/Commands/AiSmokeCommand.php` — 74 lines; the exact template for `mail:test`
  (signature with options, `config()` precondition check returning `self::FAILURE`, `$this->info`
  lines naming what was resolved, a caught exception printed as `$this->error`). Note its docblock:
  **commands are auto-discovered from `app/Console/Commands`; this project has no
  `app/Console/Kernel.php` and one must not be created.**
- `api/app/Console/Commands/{EvaluateSlaCommand,DispatchDueTaskReminders}.php` — the other two.
- `README.md:128-133` ("Turning AI Assist on." — the paragraph to imitate),
  `README.md:190` (Category 11 row), `README.md:766` (Known gaps bullet),
  `README.md:780-807` (**13. Deployment**, with the "**Environment**" bullet at `:790-793`).
- `.squad/plans/00-index.md` — needs a row `23 | transactional-email | … | WIS-27 | full`.

## Out of scope

- **No new composer dependency.** No Brevo SDK, no API transport, no `symfony/*-mailer` bridge.
  SMTP over the framework's own `smtp` mailer, or the plan must argue why not.
- **No queueing and no queue worker.** Both mailables send synchronously. Introducing
  `ShouldQueue`, a worker, or a `queue:work` cron line is a separate infrastructure story.
- **No migration and no schema change.** In particular **no `customers.locale` column**, no
  `csat_surveys.invited_at` / `notified_at` column. If the plan wants to record that an invitation
  was sent, it must do so without a migration or defer it explicitly.
- **No inbound email.** No mailbox polling, no reply-to-ticket parsing, no webhook receiver. WIS-22
  owns live channel ingestion; the README's "no real Email send-and-**receive**" caveat only half
  goes away.
- **No delivery tracking.** No Brevo webhooks, no bounce/complaint handling, no open/click
  tracking, no suppression list, no send log table or admin screen.
- **No second recipient type.** No agent notification email, no password-reset email (the
  `passwords` catalogue exists but no reset flow emails today), no digest, no SLA-breach email.
  Portal code and CSAT invitation, exactly two.
- **No SMS/WhatsApp `PortalCodeNotifier` implementation.** Story 17's Decision 4 still stands and
  ADR-005's phone-only gap is still a gap.
- **No change to `PortalCodeNotifier`'s signature**, to `PortalAccess`'s ordering, or to the portal
  `202` contract.
- **No new frontend code and no `web/` file touched.**
- **No live-credential test in CI.** Every test runs under `Mail::fake()` or `Mailable::render()`.
- **No change to the `csat.show` / `csat.store` route names or to the signed-URL scheme** —
  `CsatShareLink`'s docblock warns that renaming either invalidates every outstanding link.
