# Autonomous build pipeline — WIS-22..27

Owner authorised **full autonomy** for these six stories on 2026-09-09: squad
story + plan (Opus 5), execute (Sonnet 5), then `/plan-review` (Opus 5) — each
phase in a fresh agent context, one story fully through all phases before the
next starts. No per-file approval gate for `.squad/**` on these six.

If a session runs out of tokens, a fresh session resumes from the first
unchecked box below. Keys (Groq/Gemini for WIS-26, Brevo for WIS-27) are
supplied by the owner; the execute phase builds the adapter + config + tests
with a fake, and real-key wiring is a final step once the owner pastes them.

**Known limit:** WIS-22 / WIS-23 / WIS-24 have Done-Criteria that need external
accounts and live webhooks (WhatsApp Business, an SMS provider, a real ERP).
The execute agent builds code + unit tests against fakes and records exactly
what external setup the owner must still do; end-to-end "real inbound" criteria
stay unchecked until the owner verifies.

## Order (dependency-aware)

| # | Story | Why here |
|---|---|---|
| 1 | **WIS-25** realistic seed data | pure code, unblocks the demo |
| 2 | **WIS-26** free AI provider seam | unblocks WIS-23 |
| 3 | **WIS-27** Brevo transactional email | small, independent |
| 4 | **WIS-23** AI auto-classify + chatbot | needs WIS-26 |
| 5 | **WIS-24** integration data sync | large, mock-ERP |
| 6 | **WIS-22** live channel ingestion | largest, most external deps |

## Progress

### WIS-25 — realistic seed data
- [x] story + plan (Opus 5)
- [x] execute (Sonnet 5)
- [x] plan-review (Opus 5)

### WIS-26 — free AI provider seam
- [x] story + plan (Opus 5)
- [x] execute (Sonnet 5)
- [x] plan-review (Opus 5)
- [x] live key wired — Groq free tier, `ai:smoke` summary + reply both pass (2026-09-09)

### WIS-27 — Brevo transactional email
- [x] story + plan (Opus 5)
- [x] execute (Sonnet 5)
- [x] plan-review (Opus 5)

### WIS-23 — AI auto-classify + chatbot
- [ ] story + plan (Opus 5)
- [ ] execute (Sonnet 5)
- [ ] plan-review (Opus 5)

### WIS-24 — integration data sync
- [ ] story + plan (Opus 5)
- [ ] execute (Sonnet 5)
- [ ] plan-review (Opus 5)

### WIS-22 — live channel ingestion
- [ ] story + plan (Opus 5)
- [ ] execute (Sonnet 5)
- [ ] plan-review (Opus 5)

## Run log

- 2026-09-09 — pipeline created; starting WIS-25 story + plan.
- 2026-09-09 — WIS-25 story + plan DONE (Opus 5). Created:
  `.squad/stories/seed-data-realism/WIS-25/intake.md`,
  `.squad/plans/seed-data-realism/21-story-seed-data-realism.md` (full depth),
  `.squad/plans/seed-data-realism/00-overview.md`; row 21 added to `.squad/plans/00-index.md`.
  Key finding for the execute agent: **no test in `api/tests` runs the seeder** (grep for
  `DatabaseSeeder`/`->seed(`/`Seeder::class` returns zero), so nothing existing needs updating —
  the plan adds one new test file instead. Next: WIS-25 execute (Sonnet 5), attaching only
  `21-story-seed-data-realism.md`.
- 2026-09-09 — WIS-25 execute DONE (Sonnet 5), commit `87ef4ef`. New TicketScenarioSeeder +
  3 data files replace the 60 filler tickets with 64 authored cases; TicketFactory de-lorem'd;
  SeededDataRealismTest (10 tests) added. API 510 pass / 2,563 assertions, web 570 pass, api
  pint clean on touched paths. `migrate:fresh --seed` sanity: 64 tickets (20/12/14/18),
  channels email 30 / chat 14 / web_form 9 / whatsapp 8 / sms 3, oldest 42d, 2 no-message
  Open rows, open verdicts 3 breached / 3 at-risk, 2 finished breached, CSAT 12 (1 null),
  0 future messages, longest thread 36, 35 distinct created-days. Pre-existing (not WIS-25):
  `web` `npm run build` fails on __i18nArabicSweep TS6133 from commit 8791a4b; repo-wide
  `pint --test` dirty. Next: WIS-25 plan-review (Opus 5).
- 2026-09-09 — WIS-25 plan-review DONE (Opus 5). **10/10 Done Criteria applied**; all 11 tasks and
  every Edge Case mapped to `file:line`; all 10 planned tests present and passing; no scope creep
  (both commits touch only `.squad/`, `README.md`, `api/database/`, and the one new test file).
  Re-verified independently: API 510 pass / 2,563 assertions, web 570 pass / 91 files, and — correcting
  the execute run-log above — **`web` builds clean**: `npm run build` and `npx tsc -b --force` both
  exit 0, `npm run lint` + `i18n:check` clean. `pint --test` is dirty on 30 pre-existing files, none
  of them touched by WIS-25. Four judged deviations, all accepted: (1) `Priority` import kept in
  `DatabaseSeeder` — plan Task 9 contradicts itself, the kept SLA-rules block uses it 4×, removing it
  would break the file; (2) the outstanding CSAT survey landed on D-05 (23d) not C-05 — the plan's
  binding property, `expires_at` in the future, holds with a stable ~7-day margin; (3) D-01's
  36-message thread came from the generic planner (turn 2 is `agent_ack` not `agent_update`) — every
  property of the outlier is preserved, `next_cursor` non-null; (4) A-14 (`turns: 2`) ends on two
  customer messages with a null `first_response_at` — the code replaces rather than drops the agent
  turn to hold `turns`, and an assigned-but-not-yet-answered ticket is an honest state that breaks no
  count. Done Criteria ticked in `21-story-seed-data-realism.md`. Next: WIS-26 story + plan (Opus 5).
- 2026-09-09 — WIS-26 story + plan DONE (Opus 5). Created:
  `.squad/stories/ai-provider-seam/WIS-26/intake.md`,
  `.squad/plans/ai-provider-seam/22-story-ai-provider-seam.md` (full depth),
  `.squad/plans/ai-provider-seam/00-overview.md`; row 22 + a dependency-spine entry added to
  `.squad/plans/00-index.md`. Design: **one** `OpenAiCompatibleAssistGenerator` (Laravel `Http`,
  **no new composer package**) serves both Groq and Gemini — base URL + model + key are constructor
  args from a new `config('ai.providers')` registry; `AI_PROVIDER` selects, `ai.enabled` follows the
  selected entry's key, and an unknown provider name disables the feature rather than throwing (a
  config file that throws breaks `artisan config:cache`). Key findings for the execute agent:
  (1) **all nine** seam-touching test files set `config(['ai.enabled' => …])` at runtime and bind a
  fake via `api/tests/Pest.php` — none reads `ai.key` or opens a socket, so `Pest.php` and all nine
  stay untouched; (2) `ai_assist_artifacts.model` is **`string(64)`** — the returned model id must be
  clamped or `updateOrCreate` throws a `QueryException`, i.e. a **500** instead of the `failed` card;
  (3) the frontend needs **zero** changes — `enabled` from `TicketAssistController:30` is the only
  gate; (4) a new `php artisan ai:smoke` command is how the owner ticks the two key-dependent Done
  Criteria after pasting a free key. `.squad` files left uncommitted for the execute agent, matching
  WIS-25. Next: WIS-26 execute (Sonnet 5), attaching only `22-story-ai-provider-seam.md`.
- 2026-09-09 — WIS-26 execute DONE (Sonnet 5), commit `d1915f6`. New
  `OpenAiCompatibleAssistGenerator` (Http facade, no SDK) serves Groq + Gemini via
  constructor args from a `config('ai.providers')` registry; `config/ai.php` rebuilt as a
  provider registry (`provider`, `providers`, `temperature` added; `transcript_*` kept in
  place); `AppServiceProvider` binds by `config('ai.provider')` via `match`, unknown provider
  → `UnavailableAssistGenerator` (no throw). New `php artisan ai:smoke` command,
  `.env.example` provider block (`AI_PROVIDER=groq` default), README 3 anchors updated.
  3 new test files (23 tests): `OpenAiCompatibleAssistGeneratorTest`,
  `AssistProviderBindingTest`, `AiSmokeCommandTest`. `api/tests/Pest.php` and the 9 seam
  tests untouched. Results: API 533 pass / 2,609 assertions (was 510); web 570 pass, lint
  clean, build clean; pint clean on touched paths; `config:cache`/`clear` exits 0;
  `AI_PROVIDER=nonsense` → `enabled` false + `UnavailableAssistGenerator`. `git diff
  --name-only` shows ZERO files under `web/`, no `api/composer.json` change. Done Criteria
  3/4/5 + `.env.example`/README discharged by test; Criteria 1 & 2 (live summary + reply
  card on a real free key) stay unticked — owner runs `php artisan ai:smoke --kind=summary`
  and `--kind=reply` after pasting `GROQ_API_KEY`/`GEMINI_API_KEY`. Next: WIS-26 plan-review (Opus 5).
- 2026-09-09 — WIS-26 plan-review DONE (Opus 5). **CLEARED.** Reviewed against
  `22-story-ai-provider-seam.md` at commit **`3110c28`** (the run-log line above names `d1915f6`;
  the commit that actually landed on `main` is `3110c28`, same content — corrected here). Every
  task, edge case and Test-Plan item mapped to real code: `config/ai.php:13-35,37,41-43,50,74,77`;
  `OpenAiCompatibleAssistGenerator.php:49-54,57-61,63,68-70,72-77,82`;
  `AppServiceProvider.php:65,67-88` (lazy `Client` singleton kept, `bind` not `singleton`);
  `AiSmokeCommand.php:23,27-72`; `.env.example:67-84`; README `:128-133,:188,:768-770`. Independently
  re-verified: `php artisan test` **533 pass / 2,609 assertions**; web **570 pass**, `lint` +
  `i18n:check` clean, `build` exit 0, **zero** `web/` files and unchanged `api/composer.json` in the
  diff; `pint --test` clean on touched paths; `config:cache` then `config:clear` both exit 0;
  `AI_PROVIDER=nonsense` → `config('ai.enabled')` `false` and `UnavailableAssistGenerator` with no
  throw. Four execute-flagged items judged: (1) Context item 9's "nine files" is a **plan-text
  miscount** — the grep returns 10, the 10th being `tests/Unit/AssistTranscriptTest.php:19,36` whose
  `ai.transcript_*` keys are preserved and which Test Plan D item 5 already covers; no gap. (2) The
  two new files correctly omit `RefreshDatabase` — neither touches the database, and the plan
  specifies it. (3) Test 9's `not->toContain('.')` is **vacuous** (the default `Str::limit` suffix is
  `…`, not `.`), but its sibling `strlen(...) === 64` at
  `OpenAiCompatibleAssistGeneratorTest.php:141` does prove suffix suppression — Decision 6 is
  genuinely covered; cosmetic nit only. (4) `ai:smoke`'s extra `ticket: #id (kind)` line is an
  accepted superset. Done Criteria 3-8 ticked in the plan file. **Criteria 1 and 2 remain unticked
  by design** — they need a live free key the owner has not supplied; the discharge path
  (`php artisan ai:smoke --kind=summary|reply`) is wired and proven under `Http::fake()`/fake
  generator, so this is pending, not a failure. Next: WIS-27 story + plan (Opus 5).
- 2026-09-09 — WIS-27 story + plan DONE (Opus 5). Created:
  `.squad/stories/transactional-email/WIS-27/intake.md`,
  `.squad/plans/transactional-email/23-story-transactional-email.md` (full depth),
  `.squad/plans/transactional-email/00-overview.md`; row 23 + a dependency-spine entry added to
  `.squad/plans/00-index.md`. Design: Brevo over the framework's **stock `smtp` mailer** — five
  `.env` lines, **no new composer dependency**, no `brevo` entry in `config/mail.php`;
  `MAIL_MAILER=log` stays the committed default (and is the one-line kill switch); one hand-written
  `resources/views/mail/layout.blade.php` (markdown mailables rejected — their components are
  LTR-hardcoded and unpublished here) shared by a rewritten portal-code template and a **new**
  `CsatInvitationMail`; `php artisan mail:test {recipient} --kind=portal|csat|plain` is the owner's
  discharge path, modelled on `ai:smoke`. **Key findings for the execute agent:** (1) the Jira
  Context is **wrong** — there is no CSAT mailer, `api/app/Mail/` holds one file and `grep "Mail::"
  api/app` returns exactly one hit, so Done Criterion 2 is a *new feature*, not a re-wiring;
  (2) `TicketResolutionObserver` runs **inside** the resolving transaction
  (`TicketController.php:179-180`, `:211-241`), so the invitation must be deferred with
  `DB::afterCommit` or a rolled-back resolve emails the customer — `CsatCreationTest.php:60` gains
  the `Mail::assertNothingSent()` that proves it; (3) the **opposite** ordering on the portal path is
  already correct and load-bearing — `PortalAccess.php:76` sends *after* commit on purpose, so the
  fix there is a `catch (Throwable)` in `MailPortalCodeNotifier`, because an escaping SMTP 550 would
  500 only for identifiers that matched a real customer, i.e. an enumeration oracle;
  (4) `POST /api/tickets/bulk` takes **100 ids** (`BulkTicketActionRequest.php:19`) in one
  transaction and there is **no queue worker**, hence a `mail.csat.max_per_request` cap (default 10)
  that skips emails, never surveys; (5) `customers` has **no locale column** — `mail.customer_locale`
  is the recorded compromise for the CSAT path and a `customers.locale` migration is deferred;
  (6) **five** test files already `Mail::fake()`, four assertions in
  `PortalAccessRequestTest.php` (`:20,:46,:57,:73`) pin `PortalAccessCodeMail`'s class name and its
  `public readonly string $code` constructor — keep both; (7) `phpunit.xml:60` already sets
  `MAIL_MAILER=array`, so no test can send regardless; (8) the seeder creates tickets with their
  final status in one `create()` and `CsatSurvey` rows directly (`TicketScenarioSeeder.php:137-142,
  :486`), so the `updated`-only observer never fires on `migrate:fresh --seed` — verify, don't trust.
  `.squad` files left uncommitted for the execute agent, matching WIS-25/26. Next: WIS-27 execute
  (Sonnet 5), attaching only `23-story-transactional-email.md`.
- 2026-09-09 — WIS-27 execute DONE (Sonnet 5), commit `38cac8d`. Brevo over the stock `smtp` mailer
  — no new composer dep, `MAIL_MAILER=log` still the committed default. New shared
  `resources/views/mail/layout.blade.php` (branded, RTL-correct, inline styles); portal-code
  template rewritten to `@extends` it (keeps `<span dir="ltr">{{ $code }}</span>`); new
  `CsatInvitationMail` + `lang/{en,ar}/mail.php`; `config/mail.php` gains `customer_locale` and
  `csat.max_per_request` (default 10). CSAT invitation sent via `DB::afterCommit` in
  `TicketResolutionObserver`, only on the created-a-survey path, per-request cap via a process
  static reset in `TestCase::setUp`, `catch (Throwable)` + log at both send sites (portal notifier
  too). New `php artisan mail:test {recipient} --kind=portal|csat|plain --locale=`. README Run-it +
  Deployment + the two "no real Email" claims updated. Tests: 3 new files
  (`MailTemplateRenderTest`, `CsatInvitationMailTest`, `MailTestCommandTest`), `CsatCreationTest`
  (+`Mail::assertNothingSent()` on the rollback test) and `PortalAccessRequestTest` (+202-when-
  transport-throws) extended with every existing assertion intact; `bindThrowingMailer()` added to
  `Pest.php`. Results: API **552 pass / 2,660 assertions** (was 533); web **570 pass / 91 files**,
  `lint` clean (pre-existing warnings only), `build` clean, `i18n:check` clean; pint clean on
  touched paths; `config:cache`/`clear` exit 0; `migrate:fresh --seed` sends **zero** emails
  (Edge Case 13 verified); `mail:test` with `log` warns + exits 0 + writes the body to the log.
  `git diff --name-only` shows **zero** `web/` files and **unchanged** `api/composer.json`. Secret
  grep clean (only the commented `.env.example` guidance). Code Done Criteria all discharged; the
  **2 delivery criteria** (real email arrives) stay unticked — no Brevo creds; discharge path is
  `php artisan mail:test <you> --kind=portal|csat` after the owner pastes SMTP login + key. Known
  exposure noted in the commit: smtp `timeout` is null (out of scope). Next: WIS-27 plan-review
  (Opus 5).
- 2026-09-09 — WIS-27 plan-review DONE (Opus 5). **CLEARED.** Reviewed against
  `23-story-transactional-email.md` at commit **`48564ad`** (the run-log line above names `38cac8d`;
  the commit that actually landed on `main` is `48564ad`, same content — corrected here, same
  discrepancy as WIS-26). **14/14 code-verifiable Done Criteria applied**; all 8 tasks, all 15 edge
  cases and every Test-Plan item mapped to real code: `config/mail.php:17,134,151`;
  `resources/views/mail/layout.blade.php:2,14,23,28`; `portal-access-code.blade.php:1,7`;
  `csat-invitation.blade.php:1,11,19`; `lang/{en,ar}/mail.php` (identical key sets);
  `MailPortalCodeNotifier.php:30-44`; `CsatInvitationMail.php:31-51`;
  `TicketResolutionObserver.php:40-45,96,104-138`; `MailTestCommand.php:36-95`;
  `.env.example:52-84`; `README.md:134,207,781,808`. Re-verified independently: **API 552 pass /
  2,660 assertions**, web **570 pass / 91 files**, `npm run build` exit 0, `config:cache`+`clear`
  exit 0, `pint --test` clean on every path this story touched (the 5 dirty files are pre-existing).
  Zero `web/` paths and unchanged `api/composer.json` in the diff; secret grep returns only the
  commented `.env.example` guidance. Six executor-flagged deviations judged, **all accepted**:
  (1) `->locale()` moved from `build()` to the `CsatInvitationMail` constructor — a *correction*,
  not a drift: `Mailable::render()`/`send()` wrap `build()` in `withLocale($this->locale)`, so the
  plan's snippet would have been a no-op; Decision 6's intent is preserved and proven by
  `MailTemplateRenderTest.php:52-61`. (2) `mail:test --locale` is ignored for `--kind=csat` — correct
  per Decision 6 (CSAT always renders in `mail.customer_locale`); only the option's help text is
  mildly over-broad, and the plan's Verification 9 never pairs the two. (3) the cap counter reset
  moved from one file's `beforeEach` to `TestCase::setUp()` — strictly stronger than Test Plan B4's
  "same mechanism in every test in this file", and explicitly sanctioned by Edge Case 15; no test
  depends on cross-test accumulation. (4) file-level `uses(RefreshDatabase::class)` in
  `MailTemplateRenderTest` — Pest cannot chain `uses()` per test, so the plan's phrasing was
  unimplementable; cost is two extra DB-touching renders. (5) `@yield`/`@section` over `{{ $slot }}`
  — the plan offered both and required only consistency; both mailables `@extends`. (6) smtp
  `timeout` left `null` — Edge Case 7 required exactly this (leave it, note it in the commit
  message), and the commit does. Three claims are code-only, matching the plan's own Test Plan,
  which asked for no test of them: the concurrent double-resolve (unreachable — `queueInvitation()`
  sits after the `QueryException` return at `:93`), the cap `Log::warning` at `:116`, and
  `mail:test`'s send-failure branch at `:84-87`. One judged test substitution: the CSAT
  transport-failure test (`CsatInvitationMailTest.php:100-112`) injects a throwing `CsatShareLink`
  rather than a throwing transport, because `Mail::fake()` and `bindThrowingMailer()` are mutually
  exclusive — the throw still lands inside the identical `catch (Throwable)`, and the portal half
  uses the real throwing transport (`PortalAccessRequestTest.php:60-68`). No scope creep: no queue,
  no migration, no `brevo` mailer entry, no third mailable, no `web/` file, no composer dependency.
  The one addition beyond the plan's file list, `app/Mail/Concerns/BrandsMail.php`, is Decision 9's
  "resolve branding in a try/catch in the mailable" factored for two callers. The **2 delivery
  criteria** (a real email arrives) remain **legitimately pending, not a failure** — they need Brevo
  credentials the owner has not supplied, and the discharge path (`php artisan mail:test <you>
  --kind=portal|csat|plain`) is wired and proven under `Mail::fake()`. Next: WIS-23 story + plan
  (Opus 5).
- 2026-09-09 — WIS-26 live key wired. Owner supplied a Groq free-tier key; put `AI_PROVIDER=groq` +
  `GROQ_API_KEY` + `GROQ_MODEL=openai/gpt-oss-120b` in `api/.env` (gitignored). The plan's default
  `GROQ_MODEL` (`llama-3.3-70b-versatile`) 404s on current Groq accounts — that id is being retired —
  so `config/ai.php` and `.env.example` now default to `openai/gpt-oss-120b` (commit references
  WIS-26). `php artisan ai:smoke --kind=summary` and `--kind=reply` both return real completions;
  WIS-26 Done Criteria 1 & 2 ticked in `22-story-ai-provider-seam.md`. AI Assist cards now live in
  the running app. `--filter=Ai` suite: 98 pass / 322 assertions.
