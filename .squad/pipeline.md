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
- [ ] plan-review (Opus 5)

### WIS-27 — Brevo transactional email
- [ ] story + plan (Opus 5)
- [ ] execute (Sonnet 5)
- [ ] plan-review (Opus 5)

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
