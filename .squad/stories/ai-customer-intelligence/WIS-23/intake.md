> **Fetched from jira:** [WIS-23](https://ibrahemelahmedy.atlassian.net/browse/WIS-23)  
> *Fetched 2026-09-09T03:28:52.253Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** AI auto-classification & customer chatbot (Category 7 completion)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Context

Category 7 (AI Features) shipped partially (WIS-18): ticket **summary** and **suggested reply** exist behind the `App\Services\Ai\AssistGenerator` seam. Auto-classification and the customer-facing chatbot were scoped out.

Goal

1. **Auto-classification** — on ticket creation, propose `category` and `priority`; the agent can override. The proposal is stored with a confidence and never silently overrides a human value.
2. **Chatbot** — a customer-facing assistant that answers from the Knowledge Base and opens/updates a ticket when it cannot resolve the question.

Scope

* New `AssistGenerator` call kinds: `classify`, `chat`.
* Classification runs async on create; a low-confidence result leaves the fields untouched and flags for triage.
* Chatbot lives in the Customer Portal, grounded on published KB articles only, with an explicit "talk to a person" escape that creates a ticket carrying the transcript.
* Guardrails: token ceiling per conversation, rate limit per portal session, refusal handling.

Dependencies

* A working AI provider in production — see the provider-seam story (free provider adapter).
* Builds on `api/app/Services/Ai` and the Knowledge Base search.

Done criteria

- [ ] A new ticket gets a category/priority proposal; agent override is respected and audited.
- [ ] Low confidence => no field change, ticket flagged for triage.
- [ ] Portal chatbot answers a KB-covered question with a citation.
- [ ] "Talk to a person" creates a ticket with the full transcript attached.
- [ ] Rate limit + token ceiling enforced and tested.
- [ ] Provider failure degrades gracefully — classification is skipped, chatbot shows an unavailable state.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ai-customer-intelligence/WIS-23/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** AI Auto-Classification & Customer Chatbot (Category 7 completion)
- **Feature slug (folder under `plans/`):** `ai-customer-intelligence`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-23` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
AI auto-classification & customer chatbot (Category 7 completion)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker. The tracker's
rendering of the WIS-18 issue link was collapsed to the plain text "WIS-18" below; nothing else
is edited.)*

```
Context

Category 7 (AI Features) shipped partially (WIS-18): ticket summary and suggested reply exist
behind the App\Services\Ai\AssistGenerator seam. Auto-classification and the customer-facing
chatbot were scoped out.

Goal

	Auto-classification — on ticket creation, propose category and priority; the agent can
	override. The proposal is stored with a confidence and never silently overrides a human value.

	Chatbot — a customer-facing assistant that answers from the Knowledge Base and opens/updates a
	ticket when it cannot resolve the question.

Scope

	New AssistGenerator call kinds: classify, chat.

	Classification runs async on create; a low-confidence result leaves the fields untouched and
	flags for triage.

	Chatbot lives in the Customer Portal, grounded on published KB articles only, with an explicit
	"talk to a person" escape that creates a ticket carrying the transcript.

	Guardrails: token ceiling per conversation, rate limit per portal session, refusal handling.

Dependencies

	A working AI provider in production — see the provider-seam story (free provider adapter).

	Builds on api/app/Services/Ai and the Knowledge Base search.

Done criteria

	A new ticket gets a category/priority proposal; agent override is respected and audited.

	Low confidence => no field change, ticket flagged for triage.

	Portal chatbot answers a KB-covered question with a citation.

	"Talk to a person" creates a ticket with the full transcript attached.

	Rate limit + token ceiling enforced and tested.

	Provider failure degrades gracefully — classification is skipped, chatbot shows an unavailable
	state.
```

---

## Acceptance criteria

*(Copied verbatim from the Jira issue's "Done criteria" block. These six are the story's Done
Criteria and the plan must reproduce them word-for-word.)*

```
[ ] A new ticket gets a category/priority proposal; agent override is respected and audited.
[ ] Low confidence => no field change, ticket flagged for triage.
[ ] Portal chatbot answers a KB-covered question with a citation.
[ ] "Talk to a person" creates a ticket with the full transcript attached.
[ ] Rate limit + token ceiling enforced and tested.
[ ] Provider failure degrades gracefully — classification is skipped, chatbot shows an unavailable state.
```

**Every one of the six is code-verifiable with the fake generator** (`bindAssistGenerator()` in
`api/tests/Pest.php`). Unlike WIS-26 and WIS-27, no criterion here needs a live key or an external
account: the criteria describe *our* behaviour around the provider, not the provider's own output.
A live key nonetheless exists in `api/.env` (`AI_PROVIDER=groq`,
`GROQ_MODEL=openai/gpt-oss-120b`, `php artisan ai:smoke` passes), so the plan must also ship a
manual recipe — an `ai:smoke`-style command extension or a documented curl/tinker sequence — that
lets the owner watch a real classification and a real grounded chat answer happen. That recipe is
*evidence*, not a Done Criterion.

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| — | — |

None. Every fact this story needs is in the repository; the exact paths are listed under
**Technical hints** below.

---

## Dependencies

- **Blocked by:** **WIS-26** (`.squad/plans/ai-provider-seam/22-story-ai-provider-seam.md`) —
  **cleared and live.** `AI_PROVIDER=groq` with a real free-tier key is wired in `api/.env` and
  `php artisan ai:smoke` returns real completions. The seam this story extends is therefore
  genuinely callable in dev, not just fake-able in tests.
- **Depends on code areas / other stories:**
  - **Story 19 — ai-assist-panel (WIS-18)**, `.squad/plans/ai-assist-panel/19-story-ai-assist-panel.md`.
    Owns `AssistGenerator`, `AssistResult`, `AssistTranscript`, `TicketAssist`,
    `AssistUnavailableException`, `AssistKind`, `ai_assist_artifacts`, `config/ai.php`,
    `TicketAssistController`, `throttle:ai-assist`, `api/lang/{en,ar}/ai.php`,
    `web/src/features/ai-assist/**`. **Every decision still binds**, in particular: one
    `generate(string $system, string $transcript): AssistResult` method; a failure is always
    `AssistUnavailableException`; `config('ai.enabled')` gates every surface.
  - **Story 22 — ai-provider-seam (WIS-26)**. Owns `config('ai.providers')`,
    `OpenAiCompatibleAssistGenerator`, the `AppServiceProvider` `match`, `php artisan ai:smoke`.
    Its **deliberate deferral** is this story's problem: *"Structured / JSON-mode output. WIS-23's
    auto-classification wants a schema-constrained answer. `AssistGenerator::generate()`'s
    signature is frozen here; WIS-23 either adds a second method or a second interface."*
  - **Story 04 — ticket-management (WIS-2)**, `.squad/stories/ticket-management/WIS-2/intake.md`.
    Owns `tickets`, `Ticket::CATEGORIES`, `TicketController@store`, `StoreTicketRequest`,
    `UpdateTicketRequest`, `ticket_events` (**the single append-only ticket-history table**), and
    `Ticket::booted()`'s `category_changed` / `priority_changed` auditing.
  - **Story 09 — knowledge-base (WIS-5)**. Owns `kb_articles`, `ArticleStatus`, the
    `ArticleSearch` contract and its two engines, `KbArticle::scopeVisibleTo()`.
  - **Story 17 — customer-portal (WIS-16)**. Owns `portal_sessions`, `PortalAuth`, `PortalRequest`,
    the `portal` middleware alias, the three portal rate limiters, `PortalFaqController`,
    `PortalRequestController`, `api/lang/{en,ar}/portal.php`, `web/src/features/portal/**`,
    `web/src/i18n/locales/{en,ar}/portal.json`, and ADR-005.
  - **Story 13 — csat-collection (WIS-14)** + **Story 23 — transactional-email (WIS-27)** for the
    `DB::afterCommit` pattern inside a model observer
    (`api/app/Observers/TicketResolutionObserver.php:104-138`), and for the "one observer, one
    responsibility, registered in `AppServiceProvider::boot()`" convention.
  - **Story 06 — sla-rules-automation (WIS-6)** for the SQLite/PostgreSQL portability rule (see
    `.squad/plans/00-index.md` → *Cross-cutting rules every plan honours*).

## Extra notes (optional)

Findings verified against the code at plan time. Each is a trap the executor would otherwise hit.

1. **`category` and `priority` are BOTH `required` on ticket creation, on both creation paths.**
   `StoreTicketRequest.php:24-25` requires them from the agent UI; `PortalRequestController::store()`
   hard-codes `priority = Priority::Normal` (`:118`) and `StorePortalRequestRequest.php:27` requires
   `category`. **There is no "left at null / default" state to safely fill in.** So the "never
   silently override a human value" rule has exactly one honest implementation: classification writes
   **only** to new `ai_suggested_*` columns and **never** to `tickets.category` / `tickets.priority`.
   The agent applies a suggestion with one click, which goes through the existing
   `PATCH /api/tickets/{id}` and is therefore audited by `Ticket::booted()` for free. Any design that
   writes the live columns from the observer is wrong for this repo.

2. **Ticket creation is NOT wrapped in a transaction on the agent path** (`TicketController@store`
   calls `Ticket::create()` bare) but **IS** on the portal path (`PortalRequestController::store()`
   wraps everything in `DB::transaction`). A `created` observer therefore fires inside a transaction
   on one path and outside it on the other. `DB::afterCommit` is correct in both cases — outside a
   transaction it simply runs immediately — which is why it is the right primitive and a naked call
   is not.

3. **There is no queue worker in this repo.** `QUEUE_CONNECTION=database` and the `jobs` table
   exists, but **nothing runs `queue:work`** — no supervisor config, no composer script, no README
   instruction — and nothing in `api/app` implements `ShouldQueue`
   (`api/app/Mail/CsatInvitationMail.php:23` says so in as many words). `api/phpunit.xml:60` forces
   `QUEUE_CONNECTION=sync`, so even a queued job would run inline in tests. "Async" in the Jira text
   cannot mean "queued": a dispatched job would sit in `jobs` forever. The nearest honest equivalent is
   `app()->terminating(...)`, whose callbacks Laravel runs **after** `$response->send()`, so the
   caller does not wait on the provider. It is testable: `MakesHttpRequests::call()` calls
   `$kernel->terminate($request, $response)` at
   `vendor/laravel/framework/src/Illuminate/Foundation/Testing/Concerns/MakesHttpRequests.php:642`,
   so a feature test's `postJson()` *does* run terminating callbacks. The plan must decide between
   plain `DB::afterCommit` (simple, adds provider latency to POST /api/tickets) and
   `DB::afterCommit` + `terminating` (no perceived latency, one more moving part) and justify it.

4. **`ai_assist_artifacts` is thread-summary shaped and is a poor home for a classification.** It is
   `unique(ticket_id, kind)` with a `content` TEXT column, a `locale`, a `generated_by` FK to
   `users` (a classification has no user actor) and a `source_message_id`. Storing
   `{category, priority, confidence}` there means JSON-in-TEXT, unqueryable — and the ticket queue
   needs to *filter* on "needs triage". Prefer new nullable columns on `tickets`. Note also the
   WIS-26 gotcha: **`ai_assist_artifacts.model` is `string(64)`** and the generator clamps to it
   (`OpenAiCompatibleAssistGenerator.php:82`); any new column holding a model id must be at least
   as wide.

5. **`kb_articles` has NO `locale` column.** Verified in
   `2026_08_28_100100_create_kb_articles_table.php` — the columns are
   `title, slug, body, body_html, excerpt, kb_category_id, status, author_id, published_at,
   view_count, timestamps` and the pgsql-only `search_vector`. "Enforce the portal's locale in the
   query" is therefore **impossible as stated**; the same finding WIS-27 recorded for
   `customers.locale`. Grounding must be language-agnostic at the query level, with the *answer*
   language driven by the system prompt (`app()->getLocale()`, set by `SetLocale` from the portal
   client's `Accept-Language` header, which `portalClient.ts:59-64` always sends). The plan must say
   this out loud and record a `kb_articles.locale` migration as a deliberate deferral.

6. **The "published only" gate has an established shape — reuse it, do not re-derive it.**
   `PortalFaqController::index()` uses `where('status', ArticleStatus::Published->value)
   ->whereNotNull('published_at')` — **both** clauses. `KbArticle::scopeVisibleTo()` takes a `?User`
   and is the *staff* boundary; a portal caller has no `User`, so passing `null` happens to work but
   is semantically wrong and must not be used. The retrieval query for grounding must be built from
   the `PortalFaqController` pair plus `ArticleSearch::apply()`, exactly as `index()` composes them
   (filter first, then rank).

7. **`ApiContractTest.php:322-343` is load-bearing and will fail a careless new route.** It walks
   the router, and for **every** route whose URI starts with `api/portal/` asserts (a) `auth:sanctum`
   is absent and (b) at least one of `throttle:portal-access`, `throttle:portal-verify`, `portal` is
   present. A chat route inside the existing `Route::prefix('portal')->middleware(['portal', ...])`
   group satisfies it; a *public* chat route with only a new `throttle:portal-chat` limiter would
   **fail** it. The chatbot is session-gated, so this is a constraint, not a blocker — but the plan
   must state which group each new route joins.

8. **The per-conversation guardrails cannot be enforced by a rate limiter alone.** `throttle:portal`
   is already 60/min keyed on the bearer token (`bootstrap/app.php:56-57`). A *token ceiling per
   conversation* is application state and must live in a column the chat service checks before
   calling the provider; the limiter only bounds request rate. Both are needed, they are not
   substitutes, and Done Criterion 5 ("rate limit + token ceiling enforced and tested") names both.

9. **`bindAssistGenerator()`'s docblock records a real trap** (`api/tests/Pest.php:48-72`):
   `Illuminate\Routing\Route::getController()` caches the resolved controller on the Route object,
   so a second `app()->instance(AssistGenerator::class, …)` mid-test has no effect on an
   already-resolved controller. Drive multi-turn behaviour through the **one** fake instance
   (`respondWith()` queues FIFO, `failNext()` throws once). A multi-turn chatbot test is exactly the
   case that would trip over this.

10. **Ticket history is already the audit trail for an override.** `Ticket::booted()`
    (`app/Models/Ticket.php:203-229`) writes `category_changed` / `priority_changed` rows to
    `ticket_events` on any change, with `user_id = auth()->id()`. Done Criterion 1's "agent override
    is respected and audited" is therefore mostly discharged by existing code — the plan should
    *assert* that in a test rather than build a second audit path. Nothing about ticket lifecycle
    may go into `audit_logs` (index cross-cutting rule).

11. **A new `ticket_events.event` value degrades safely in the SPA.**
    `ActivityList.tsx:12-20` maps known event values to i18n keys and falls back to
    `t('activity.generic', { who, event })`. Adding e.g. `ai_classified` will render, ungracefully,
    without a frontend change — so add the label, but know the UI cannot break.

12. **The portal frontend has no chat surface and no nav entry for one.** `PortalLayout.tsx` is a
    header with only a wordmark, a language pill and a theme toggle — no nav bar at all; navigation
    lives inside the pages. Routes are declared in `web/src/App.tsx:70-82` under `/portal`, with the
    session-gated ones nested under `<RequirePortalSession />`. `web/src/features/portal/index.ts`
    is the barrel `App.tsx` imports from. A new page must be added in all three places.

13. **The portal SPA uses its own Axios instance** (`portalClient.ts`) which attaches the portal
    bearer token and a 401 → sign-out interceptor. A chat call must go through `portalApi.ts` /
    `portalClient`, never `web/src/lib/api.ts` (the staff instance). This is the frontend half of
    the two-identities rule.

14. **`npm run lint` runs `i18n:check` (`scripts/check-no-literals.mjs`).** Every user-visible string
    in a new React component must come from a namespace catalogue, and `catalogueParity.test.ts`
    requires `en` and `ar` key sets to be identical. New chat strings belong in
    `web/src/i18n/locales/{en,ar}/portal.json`; new agent-side classification strings belong in
    `conversation.json` (where `section.classification` and the `activity.*` keys already live).

15. **Server-side copy is localised server-side** (index cross-cutting rule). Any new
    `*_label`, refusal message or unavailable message returned by the API resolves through `__()`
    against `api/lang/{en,ar}` — `ai.php` already holds `unavailable` and `failed`, `portal.php`
    holds the portal strings.

16. **All SQL must be valid on PostgreSQL *and* SQLite** (index cross-cutting rule). Today both
    `api/.env` and `api/phpunit.xml:52-58` point at PostgreSQL (`wisal_testing` locally, Supabase in
    dev) because `pdo_sqlite` is blocked on the owner's machine — see
    `docs/debugging/002-pdo-sqlite-blocked.md` — but `phpunit.xml`'s own comment says CI may export
    `DB_CONNECTION=sqlite` and switch back. So the rule still holds: no `NULLS LAST`, no `INTERVAL`
    or `julianday()` arithmetic, no bare `LIKE` with backslash escapes. `LikeArticleSearch` and
    `Priority::sortExpression()` show the house style. Note the practical consequence for grounding:
    **on the test/dev connection `ArticleSearch` resolves to `PostgresArticleSearch`**
    (`AppServiceProvider:42-45` picks by driver), so the `search_vector` path is what the suite
    actually exercises.

17. **`config('ai.timeout')` is 30s and is honoured by `OpenAiCompatibleAssistGenerator` only.** A
    chat turn inherits it. A classification running in a terminating callback also inherits it — the
    plan should say whether classification gets its own (shorter) budget, and if so where it lives
    in `config('ai')`.

## Technical hints (optional)

Repos/roots: `.` (`api/` Laravel 13 + `web/` React 19 + Vite). Files this story reads or touches:

**AI seam (WIS-18 + WIS-26)**
- `api/app/Services/Ai/AssistGenerator.php` — the interface; one method,
  `generate(string $system, string $transcript): AssistResult`.
- `api/app/Services/Ai/AssistResult.php` — `readonly {content, model, inputTokens, outputTokens}`.
- `api/app/Services/Ai/AssistTranscript.php` — the prompt builder (`SUMMARY_SYSTEM`,
  `REPLY_SYSTEM`, `window()`, `localize()`, `render()`); the model for any new prompt builder.
- `api/app/Services/Ai/TicketAssist.php` — the state machine; the model for any new service.
- `api/app/Services/Ai/OpenAiCompatibleAssistGenerator.php` — the live implementation
  (`:37-88`): timeout, refusal check *before* reading content, empty-completion check, 64-char model
  clamp.
- `api/app/Services/Ai/UnavailableAssistGenerator.php`, `AnthropicAssistGenerator.php`.
- `api/app/Exceptions/AssistUnavailableException.php` — a bare `RuntimeException`.
- `api/app/Enums/AssistKind.php` — `summary | suggested_reply`.
- `api/config/ai.php` — the provider registry plus `enabled`, `key`, `model`, `effort`,
  `max_tokens`, `temperature`, `timeout`, `transcript_messages`, `transcript_chars`.
- `api/app/Providers/AppServiceProvider.php:60-88` — the `AssistGenerator` bind (`match` on
  `config('ai.provider')`), and `:113` `Ticket::observe(TicketResolutionObserver::class)`.
- `api/app/Console/Commands/AiSmokeCommand.php` — the owner's manual-verification pattern.
- `api/database/migrations/2026_09_03_100000_create_ai_assist_artifacts_table.php` — note
  `model` is `string(64)`.
- `api/app/Http/Controllers/TicketAssistController.php:30,58,62-68` — the `enabled` gate and the
  `AssistUnavailableException` → `503 __('ai.failed')` mapping to mirror.
- `api/routes/api.php:72-86` — the four AI routes and `throttle:ai-assist`.
- `api/lang/{en,ar}/ai.php` — `unavailable`, `failed`.

**Ticket creation (WIS-2)**
- `api/app/Http/Controllers/TicketController.php:63-116` (`store`) and `:126-…` (`update`).
- `api/app/Http/Requests/StoreTicketRequest.php`, `UpdateTicketRequest.php`.
- `api/app/Models/Ticket.php` — `CATEGORIES` (`:19`), `$fillable` (`:21-31`), `casts()`,
  `categoryLabel()` (`:54-63`), `scopeFilter()` (`:118-140`), `scopeSorted()`, `booted()`
  (`:203-229`), `recordEvent()` (`:258-269`).
- `api/app/Enums/Priority.php`, `api/app/Enums/TicketStatus.php`, `api/app/Enums/Channel.php`.
- `api/app/Services/TicketAssigner.php`, `api/app/Services/SlaClock.php` (both run in `store`).
- `api/app/Http/Resources/TicketResource.php` — the frozen resource shape; new keys append.
- `api/app/Http/Resources/TicketEventResource.php`.
- `api/app/Observers/TicketResolutionObserver.php:36-45,96,104-138` — the `DB::afterCommit`
  + per-request-cap + `catch (Throwable)` pattern to copy.

**Knowledge Base (WIS-5)**
- `api/app/Services/Kb/ArticleSearch.php` (interface), `LikeArticleSearch.php`,
  `PostgresArticleSearch.php`; bound in `AppServiceProvider:42-45` by driver.
- `api/app/Models/KbArticle.php` — `$fillable`, `scopeVisibleTo()` (staff-only), `isPublished()`.
- `api/app/Enums/ArticleStatus.php`.
- `api/database/migrations/2026_08_28_100100_create_kb_articles_table.php` and
  `…_100300_add_search_vector_to_kb_articles.php`.
- `api/app/Http/Resources/PortalArticleResource.php`.

**Customer Portal (WIS-16)**
- `api/routes/api.php:289-316` — the public `portal` group (`throttle:portal-access` /
  `throttle:portal-verify`) and the session group (`['portal', 'throttle:portal']`).
- `api/app/Http/Middleware/PortalAuth.php` — sets `portal_session` and `portal_customer` request
  attributes; never `Auth::login()`.
- `api/app/Http/PortalRequest.php` — `PortalRequest::customer($request)`.
- `api/app/Models/PortalSession.php`, `api/database/migrations/…_create_portal_sessions_table.php`.
- `api/app/Http/Controllers/Portal/PortalRequestController.php` — `ownedTicket()`'s single-404 code
  path, `store()`'s transaction, `reply()`'s notification + `last_contact_at` rule.
- `api/app/Http/Controllers/Portal/PortalFaqController.php` — the published-only query to reuse.
- `api/app/Http/Requests/StorePortalRequestRequest.php`.
- `api/app/Services/PortalAccess.php`, `api/app/Http/Controllers/Portal/PortalSessionController.php`.
- `api/lang/{en,ar}/portal.php`.
- `api/bootstrap/app.php:20-70` — all six rate limiters; the file a new limiter is registered in.
- `docs/decisions/ADR-005-customer-portal-access.md`.

**Frontend**
- `web/src/App.tsx:64-82` — the `/portal` route tree.
- `web/src/features/portal/index.ts`, `PortalLayout.tsx`, `portal.css`,
  `api/portalClient.ts`, `api/portalApi.ts`, `model/portal.ts`, `model/portalKeys.ts`,
  `hooks/usePortal*.ts`, `components/PortalStates.tsx` (loading/empty/error), `components/MessageBubble.tsx`,
  `pages/PortalRequestDetailPage.tsx` (the closest existing "thread + composer" screen),
  `testUtils.tsx`.
- `web/src/features/tickets/components/thread/TicketMetaPanel.tsx:26-40` — `topSlot` / `extraSlot`;
  `ClassificationCard.tsx` (the category/channel chips — the natural home for a suggestion chip);
  `ActivityList.tsx:12-20`.
- `web/src/features/ai-assist/**` (10 files) — the existing card pattern:
  `hooks/useTicketAssist.ts`, `hooks/useAssistMutations.ts`, `api/assistApi.ts`, `model/assist.ts`.
- `web/src/i18n/index.ts`, `instance.ts` (`NAMESPACES`), `locales/{en,ar}/{portal,conversation}.json`,
  `catalogueParity.test.ts`, `noHardcodedStrings.test.ts`, `scripts/check-no-literals.mjs`.

**Tests**
- `api/tests/Pest.php:48-115` — `bindAssistGenerator()` / `bindFailingAssistGenerator()`; the
  controller-caching warning; `TestCase::setUp()` resets the WIS-27 counter (precedent for resetting
  per-process state).
- `api/tests/Feature/Ai/*` (11 files) — every existing seam test.
- `api/tests/Feature/Portal/*` (13 files) — in particular `PortalRateLimitTest.php`,
  `PortalTokenIsolationTest.php`, `PortalEnumerationTest.php`,
  `PortalInternalNoteLeakTest.php`, `PortalTicketSubmissionTest.php`.
- `api/tests/Feature/Kb/ArticleVisibilityTest.php`, `ArticleSearchTest.php`.
- `api/tests/Feature/ApiContractTest.php:322-358` — the portal-route gate test and the
  `GET /api/tickets/{id}/ai-assist` shape lock.
- `api/tests/Feature/Seeding/*` — the seeder assertions a new ticket column may touch.
- `api/phpunit.xml` — the test connection and `MAIL_MAILER=array`.

## Out of scope

- **No change to `AssistGenerator::generate()`'s signature** unless the plan's own Decision 1 argues
  for one and pays for it in *both* implementations (`OpenAiCompatibleAssistGenerator`,
  `AnthropicAssistGenerator`) plus `UnavailableAssistGenerator` and both fakes in `Pest.php`.
- **No queue, no worker, no scheduled job**, and no change to `QUEUE_CONNECTION`. There is no
  infrastructure to run one.
- **No new composer or npm dependency.** No embeddings library, no vector store, no tokenizer
  package — a token *estimate* from `AssistResult::$inputTokens + $outputTokens` (what the provider
  itself reports) is the ceiling's input.
- **No semantic/vector KB retrieval.** Grounding uses the existing `ArticleSearch` contract.
  Embeddings are a later story.
- **No `kb_articles.locale` migration** and no per-locale article variants (Extra note 5).
- **No chatbot for staff**, no chat on the agent-facing ticket thread, no live agent handoff /
  presence. "Talk to a person" creates a ticket; it does not open a live session.
- **No streaming responses.** One request, one answer, exactly as WIS-26 froze.
- **No auto-application of a classification to `tickets.category` / `tickets.priority`** by any
  server-side path. A human click through the existing `PATCH /api/tickets/{id}` is the only writer.
- **No re-classification loop** — no re-running classification on every update, no batch
  re-classify command for existing tickets, no scheduled sweep.
- **No cost/usage dashboard.** Token counters are stored and enforced; nothing new *reports* them.
- **No changes to `audit_logs`.** Ticket history is `ticket_events`, full stop.
- **No second identity anywhere.** No chatbot route may carry `auth:sanctum`; no chatbot query may
  reach a non-published article or another customer's ticket.
- **Not WIS-22 and not WIS-24.** No channel ingestion, no ERP sync.
