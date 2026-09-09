# Story 24 — AI Auto-Classification & Customer Chatbot: Category 7 completion (Story: WIS-23)

---

## Prerequisites

- **Story 19 completed** — [`../ai-assist-panel/19-story-ai-assist-panel.md`](../ai-assist-panel/19-story-ai-assist-panel.md).
  Owns `AssistGenerator`, `AssistResult`, `AssistTranscript`, `TicketAssist`,
  `AssistUnavailableException`, `AssistKind`, `ai_assist_artifacts`, `config/ai.php`,
  `TicketAssistController`, `throttle:ai-assist`, `api/lang/{en,ar}/ai.php`. **Every decision still
  binds**: one `generate(string $system, string $transcript): AssistResult`; every failure is
  `AssistUnavailableException`; `config('ai.enabled')` gates every surface.
- **Story 22 completed and LIVE** — [`../ai-provider-seam/22-story-ai-provider-seam.md`](../ai-provider-seam/22-story-ai-provider-seam.md).
  `AI_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-120b` and a real free-tier key are in `api/.env`
  (gitignored); `php artisan ai:smoke --kind=summary|reply` returns real completions. This story
  discharges Story 22's recorded deferral: *"Structured / JSON-mode output … WIS-23 either adds a
  second method or a second interface."* **Decision 1 below chooses neither.**
- **Story 04 completed** — [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md).
  Owns `tickets`, `Ticket::CATEGORIES`, `TicketController@store/@update`, and `ticket_events` —
  **the single append-only ticket-history table**. Nothing about ticket lifecycle goes to `audit_logs`.
- **Story 09 completed** — [`../knowledge-base/09-story-knowledge-base.md`](../knowledge-base/09-story-knowledge-base.md).
  Owns `kb_articles`, `ArticleStatus`, the `ArticleSearch` contract and its two engines.
- **Story 17 completed** — [`../customer-portal/17-story-customer-portal.md`](../customer-portal/17-story-customer-portal.md).
  Owns `portal_sessions`, `PortalAuth`, `PortalRequest`, the `portal` middleware alias, the portal
  limiters, and `web/src/features/portal/**`. **ADR-005 is binding**: a portal identity is
  structurally incapable of authenticating a staff route.
- **Story 23 completed** — [`../transactional-email/23-story-transactional-email.md`](../transactional-email/23-story-transactional-email.md).
  Supplies the `DB::afterCommit` + per-process-cap + `catch (Throwable)` pattern inside a model
  observer (`api/app/Observers/TicketResolutionObserver.php:104-138`) and the
  `TestCase::setUp()` counter reset (`api/tests/TestCase.php:15-16`). **Copy that shape.**

Coordinate with nothing else in flight: WIS-24 and WIS-22 have not started.

---

## Story Goal

Complete Category 7 with the two AI features WIS-18 scoped out.

1. **Auto-classification.** Every newly created ticket — from the agent UI, from the Customer
   Portal, or from the chatbot's own escalation — gets an AI *proposal* for `category` and
   `priority`, stored on the ticket row with a confidence. The proposal is **never** applied
   automatically. When confidence is below the threshold, no proposal is stored and the ticket is
   flagged `needs_triage`. When the provider fails, the ticket is completely unaffected.
2. **Customer chatbot.** A signed-in portal customer can ask questions in
   `/portal/chat`. Answers are grounded **only** on published KB articles, returned with citations
   the customer can open. A "Talk to a person" button ends the conversation and creates a real
   ticket carrying the full transcript. Token ceiling, message ceiling and a per-session rate limit
   are enforced server-side; a provider outage renders a calm "unavailable" state, not an error.

**Not in scope** (restated from the intake so the executor does not drift): no queue/worker, no new
composer or npm dependency, no embeddings or vector search, no `kb_articles.locale`, no streaming,
no staff-facing chatbot, no live agent handoff, no re-classification of existing tickets, no
auto-write to `tickets.category` / `tickets.priority` from any server path, no cost dashboard, no
`audit_logs` change, and no `auth:sanctum` anywhere near a chatbot route.

---

## Context — Read These Files First

1. `api/app/Services/Ai/AssistGenerator.php` — the whole interface, 20 lines. One method,
   `generate(string $system, string $transcript): AssistResult`, `@throws AssistUnavailableException`.
   **Decision 1 does not change it.**
2. `api/app/Services/Ai/AssistResult.php` — `final readonly` with
   `content`, `model`, `inputTokens`, `outputTokens`. The token counters are what the chat ceiling
   accumulates; there is no tokenizer in this repo and none is being added.
3. `api/app/Services/Ai/AssistTranscript.php` — the prompt-builder pattern to copy: `private const
   SUMMARY_SYSTEM` / `REPLY_SYSTEM` string constants at the top (`:17`, `:19`), a public method per
   kind returning `[$system, $prompt]`, `localize()` (`:81-93`) appending one sentence for Arabic,
   `render()` (`:112-129`) building the user turn. **No HTTP, no model call — unit-testable.**
4. `api/app/Services/Ai/TicketAssist.php` — the service pattern: constructor-injected
   `AssistGenerator` + prompt builder, `generate()` lets `AssistUnavailableException` propagate, the
   controller owns the HTTP mapping.
5. `api/app/Services/Ai/OpenAiCompatibleAssistGenerator.php:37-88` — the live provider. Read
   `:63-70` (content-filter refusal check **before** reading content), `:72-77` (empty completion),
   `:82` (`Str::limit(..., 64, '')` because `ai_assist_artifacts.model` is `string(64)`).
6. `api/app/Http/Controllers/TicketAssistController.php:28-35,56-75` — the `enabled` gate returning
   `503 __('ai.unavailable')` and the `AssistUnavailableException` → `503 __('ai.failed')` mapping.
   The chatbot mirrors this shape but returns a **200 with a `state`**, not a 503 — see Decision 10.
7. `api/config/ai.php` — the whole file (85 lines). Note `provider`, `providers`, `enabled`, `key`,
   `model`, `effort`, `max_tokens`, `temperature`, `timeout`, `transcript_messages`,
   `transcript_chars`. Two new blocks are appended by Task 1; **nothing existing moves or is renamed.**
8. `api/app/Providers/AppServiceProvider.php:60-88` (the `AssistGenerator` `match` bind) and
   `:113` (`Ticket::observe(TicketResolutionObserver::class)` — where the second observer is registered).
9. `api/app/Observers/TicketResolutionObserver.php:36-45` (the process static + `resetInvitationCounter()`),
   `:104-138` (`queueInvitation()`: the cap check, `DB::afterCommit`, `catch (Throwable)` + `Log::error`).
   **This file is the template for `TicketClassificationObserver`.**
10. `api/app/Http/Controllers/TicketController.php:63-119` (`store`) — note there is **no
    `DB::transaction`** here, and `Ticket::create($data)` at `:91` is followed by
    `$this->clock->applyTo($ticket); $ticket->save();` at `:95-96`, then the first `TicketMessage`
    at `:108-114`. Also read `:126-192` (`update`) — Task 8 adds three lines to it.
11. `api/app/Http/Requests/StoreTicketRequest.php:20-28` — **`category` and `priority` are both
    `required`.** `api/app/Http/Requests/StorePortalRequestRequest.php:24-28` — `category` required,
    `priority` not accepted at all. This pair is the entire justification for Decision 4.
12. `api/app/Models/Ticket.php` — `CATEGORIES` (`:19`), `$fillable` (`:21-31`), `casts()` (`:33-51`),
    `categoryLabel()` (`:54-63`), `scopeFilter()` (`:118-140`), `booted()` (`:203-229` — the
    `category_changed` / `priority_changed` audit rows Done Criterion 1 relies on),
    `recordEvent()` (`:258-269`).
13. `api/app/Http/Controllers/Portal/PortalFaqController.php:24-40` — the **exact** published-only
    query pair (`where('status', ArticleStatus::Published->value)` **and**
    `whereNotNull('published_at')`) composed with `$this->search->apply($query, $term)`. Task 11
    reuses this composition; do **not** use `KbArticle::scopeVisibleTo()`, which is the staff boundary.
14. `api/app/Http/Controllers/Portal/PortalRequestController.php:41-71` (`index` + the
    `ownedTicket()` single-404 code path), `:104-150` (`store` — the `DB::transaction`, the
    hard-coded `Priority::Normal` at `:118` with its comment about `SlaClock`, the
    `TicketAssigner->pick()` at `:122-126`, the description→first-message copy at `:139-146`).
    **Task 14's escalation is this method with a different body source.**
15. `api/app/Http/Middleware/PortalAuth.php` and `api/app/Http/PortalRequest.php` — the two request
    attributes (`portal_session`, `portal_customer`) and the two accessors
    `PortalRequest::customer($request)` / `PortalRequest::session($request)`.
16. `api/routes/api.php:286-316` — the two portal groups. **New chat routes join the second group
    (`['portal', 'throttle:portal']`)**, which is what keeps `ApiContractTest` green.
17. `api/tests/Feature/ApiContractTest.php:314-343` — the router walk that fails any `api/portal/*`
    route carrying `auth:sanctum` or lacking a portal gate. `:345-358` — the `ai-assist` shape lock,
    the pattern Test Plan **I** copies for the two new chat shapes.
18. `api/bootstrap/app.php:20-70` — all six limiters. Task 2 appends a seventh, `portal-chat`,
    directly after the `ai-assist` block at `:64-69`.
19. `api/tests/Pest.php:48-115` — `bindAssistGenerator()` (`respondWith()` queues FIFO,
    `failNext()` throws once, `$calls` records every `[$system, $transcript]` pair) and
    `bindFailingAssistGenerator()`. **Read the docblock warning at `:52-63` about
    `Route::getController()` caching a resolved controller — a multi-turn chat test is exactly the
    case it warns about.** This file is **not modified** by this story.
20. `api/tests/TestCase.php:11-18` — where `TicketClassificationObserver::resetClassificationCounter()`
    joins the existing CSAT reset.
21. `web/src/App.tsx:64-82` — the `/portal` route tree and the `<RequirePortalSession />` nesting.
22. `web/src/features/portal/api/portalClient.ts` (the portal-only Axios instance, its bearer
    injection at `:47-52` and the locale header at `:56-64`), `api/portalApi.ts` (every existing
    call), `components/PortalStates.tsx` (`PortalSkeleton` / `PortalEmpty` / `PortalError` — the
    four mandatory async states), `components/MessageBubble.tsx`,
    `pages/PortalRequestDetailPage.tsx` (the closest existing thread+composer screen),
    `model/portalKeys.ts`, `index.ts` (the barrel `App.tsx` imports from).
23. `web/src/features/tickets/components/thread/ClassificationCard.tsx` — 19 lines, the two chips.
    Task 24 extends it. `ActivityList.tsx:12-20` — `EVENT_KEYS` plus the `activity.generic` fallback.
    `web/src/features/tickets/model/ticket.ts:22-45` — the `Ticket` type mirroring `TicketResource`.
24. `web/src/i18n/locales/en/portal.json` and `.../conversation.json` — the two catalogues that gain
    keys. `web/src/i18n/catalogueParity.test.ts` requires `en` and `ar` key sets to be **identical**;
    `npm run lint` runs `scripts/check-no-literals.mjs`, which fails on any hard-coded user string.
25. Grep for `RateLimiter::for` in `api/bootstrap/app.php` and for `throttle:` in
    `api/routes/api.php` before adding the new limiter, so the naming matches.

---

## Decisions

Ten decisions. Each is binding; deviating from one is a plan revision, not an implementation detail.

### Decision 1 — Do **not** change the `AssistGenerator` seam. Encode structure in the prompt and parse JSON defensively.

`generate(string $system, string $transcript): AssistResult` stays exactly as it is. Both new call
kinds (classify, chat) are ordinary text generations whose **system prompt demands a single JSON
object**, parsed by a new `App\Services\Ai\JsonAnswer` helper.

Why not a new method or a second interface:

- Adding `generateJson()` would touch **three** implementations (`OpenAiCompatibleAssistGenerator`,
  `AnthropicAssistGenerator`, `UnavailableAssistGenerator`) plus **two** fakes in
  `api/tests/Pest.php:64-115`, and every anonymous-class fake inside the 11 files under
  `api/tests/Feature/Ai/`. The blast radius is the whole seam for zero behavioural gain.
- Provider JSON modes are **not** portable. Groq's OpenAI-compatible layer accepts
  `response_format: {type: "json_object"}`; the Anthropic SDK path does not take that parameter at
  all. A seam whose contract only holds for two of three providers is not a seam.
- The failure semantics we need already exist: an unparseable answer is *information*, and
  Decisions 5 and 10 both have a defined behaviour for it (low confidence / unavailable). No
  exception type is needed.

**`JsonAnswer::parse()` is defensive by construction**: strip a leading/trailing ```` ```json ````
fence, take the substring from the first `{` to the last `}`, `json_decode(..., true)`, return
`null` on any failure or on a non-array result. It never throws.

### Decision 2 — Classification runs from a `Ticket::created` observer, deferred with `DB::afterCommit` **and** `app()->terminating()`.

Not synchronously in `TicketController@store` (that would add a 30-second-budget provider call to
the ticket-create latency and a new failure surface on the app's most-used write path). Not queued —
`QUEUE_CONNECTION=database` but **nothing runs `queue:work`**, so a dispatched job would sit in
`jobs` forever, and `api/phpunit.xml:60` forces `sync` anyway.

```php
// TicketClassificationObserver::created()
DB::afterCommit(function () use ($ticket) {
    app()->terminating(fn () => $this->classify($ticket));
});
```

- `DB::afterCommit` is required because the two creation paths differ: `TicketController@store`
  runs **outside** a transaction (`:91`), `PortalRequestController::store()` runs **inside** one
  (`:107`). Outside a transaction the callback fires immediately; inside, on commit. A rolled-back
  create therefore never classifies.
- `app()->terminating()` runs after `$response->send()`, so the HTTP caller never waits on the
  provider. It is testable: `MakesHttpRequests::call()` invokes `$kernel->terminate($request, $response)`
  at `vendor/laravel/framework/src/Illuminate/Foundation/Testing/Concerns/MakesHttpRequests.php:642`,
  so a feature test's `postJson()` **does** run terminating callbacks before the assertion.

**Two hard guards, both mandatory** (this is where the seeder hazard lives):

1. `if (app()->runningInConsole()) return;` — `php artisan migrate:fresh --seed` creates 64 tickets
   (`TicketScenarioSeeder`); without this guard the console kernel's terminate would fire 64
   provider calls. WIS-27 verified the identical property for CSAT email (its Edge Case 13); this
   story verifies it again by test.
2. A per-process cap, `config('ai.classify.max_per_request')`, default **3**, held in a
   `private static int` exactly like `TicketResolutionObserver::$sentThisRequest` (`:39`), with a
   `public static function resetClassificationCounter()` called from `Tests\TestCase::setUp()`.
   `POST /api/tickets/bulk` cannot create tickets, but a future importer could, and the cap costs
   four lines.

### Decision 3 — Classification is stored in **six new nullable columns on `tickets`**, not in `ai_assist_artifacts`.

```
ai_suggested_category    string(32)  nullable
ai_suggested_priority    string(16)  nullable
ai_confidence            decimal(3,2) nullable   -- 0.00 … 1.00
ai_classified_at         timestamp   nullable
ai_classification_model  string(64)  nullable
needs_triage             boolean     default false
```
plus `index('needs_triage')`.

`ai_assist_artifacts` is the wrong home and would have to be bent to fit: it is
`unique(ticket_id, kind)` over a `content` **TEXT** column, with a required `locale`, a
`generated_by` FK to `users` (a classification has no user actor) and a `source_message_id`.
Storing `{category, priority, confidence}` there means JSON-in-TEXT — and the ticket queue must
**filter** on "needs triage" (Done Criterion 2), which a TEXT blob cannot do without a full scan.
Six nullable columns on the row the feature is about are queryable, indexable, and cost one
migration.

`ai_classification_model` is `string(64)` to match `ai_assist_artifacts.model` and the existing
64-character clamp at `OpenAiCompatibleAssistGenerator.php:82` — **do not widen it, clamp the value**.

`ai_confidence` is cast `'float'`, **not** `'decimal:2'`: Laravel's `decimal` cast returns a
*string*, and `TicketResource` would then emit `"0.90"` where the SPA expects a number. PostgreSQL
returns `numeric` as a string over PDO, so the cast is load-bearing on the live driver.

### Decision 4 — "A human value is never overridden" means classification **never writes `tickets.category` or `tickets.priority`**. Full stop.

The alternative ("write the fields only when the creator left them at a default/null") is
**impossible in this repo**: `StoreTicketRequest.php:24-25` makes both `category` and `priority`
`required`, and `PortalRequestController::store():118` hard-codes `Priority::Normal` with a comment
explaining that `SlaClock::applyTo()` needs a real enum instance. There is no "unset" state to
distinguish from a deliberate choice, so any auto-write is by definition overriding a human value.

Therefore:

- The observer writes **only** the six columns of Decision 3.
- The agent applies a suggestion with one click in `ClassificationCard`, which issues the existing
  `PATCH /api/tickets/{id}` with `{category, priority}`. That path already runs
  `TicketPolicy@update` and already writes `category_changed` / `priority_changed` rows to
  `ticket_events` via `Ticket::booted():206-219`. **Done Criterion 1's "audited" is discharged by
  existing code**; this story asserts it rather than building a second audit path.
- Applying **or** explicitly dismissing clears `needs_triage`.

This is directly testable, and the test is the criterion: create a ticket with
`category=billing, priority=low`, have the fake return `{"category":"technical","priority":"urgent","confidence":0.95}`,
then assert `$ticket->fresh()->category === 'billing'`, `priority === Priority::Low`,
`ai_suggested_category === 'technical'`, and that `ticket_events` holds **no** `category_changed` row.

### Decision 5 — Confidence threshold `0.6`; below it, nothing is suggested and `needs_triage` is set. A provider failure writes **nothing at all**.

Three outcomes, and they must stay distinguishable:

| Outcome | `ai_suggested_*` | `ai_confidence` | `ai_classified_at` | `needs_triage` |
|---|---|---|---|---|
| Confident (`>= config('ai.classify.min_confidence')`, default `0.60`) | the values | the number | `now()` | `false` |
| Low confidence, or unparseable JSON, or a value outside `Ticket::CATEGORIES` / `Priority` | `null` | the number, or `0` when unparseable | `now()` | **`true`** |
| `AssistUnavailableException`, or `config('ai.enabled') === false` | `null` | `null` | **`null`** | `false` |

Row 3 is Done Criterion 6's "classification is skipped, ticket unaffected": a null `ai_classified_at`
is how the app knows the ticket was never looked at, as opposed to looked at and found ambiguous.
An invalid enum value from the model is treated as low confidence, never as a partial success —
half a suggestion is worse than none.

The write is a single `Ticket::whereKey($id)->update([...])` on the **base builder**, not
`$ticket->update()`: an Eloquent update would fire `Ticket::booted()`'s `updated` hook and the
`TicketResolutionObserver`, for a change that is not a lifecycle event. This mirrors
`PortalFaqController::show()`'s deliberate `->getQuery()->increment('view_count')` at `:57`.

### Decision 6 — Chatbot state lives in **two new tables keyed on the portal session**.

`portal_chat_conversations` — one live conversation per `portal_session_id`:

```
id, portal_session_id (FK portal_sessions cascadeOnDelete),
customer_id (FK customers cascadeOnDelete), locale string(8),
state string(16) default 'active',            -- App\Enums\PortalChatState
message_count unsignedInteger default 0,
input_tokens unsignedInteger default 0,
output_tokens unsignedInteger default 0,
escalated_ticket_id (FK tickets nullOnDelete, nullable),
timestamps
index('portal_session_id')
```

`portal_chat_messages`:

```
id, portal_chat_conversation_id (FK cascadeOnDelete),
role string(16),                              -- 'customer' | 'assistant'
body text,
citations json nullable,                      -- [{id, slug, title}], cast 'array'
input_tokens unsignedInteger default 0,
output_tokens unsignedInteger default 0,
timestamps
index(['portal_chat_conversation_id', 'id'])
```

Keyed on the **session**, not the customer: signing out revokes the session, and the next sign-in
starts a fresh conversation with a fresh ceiling. That is the correct privacy default for a shared
device and it makes the ceiling un-evadable within one session. `customer_id` is denormalised onto
the conversation so escalation does not have to reach through the session row.

The token counters are the *provider's own* `AssistResult::$inputTokens + $outputTokens`,
accumulated per turn. There is no tokenizer in this repo and none is being added; a provider that
reports `0` simply never trips the ceiling, which is a documented limitation, not a bug.

### Decision 7 — Grounding: published-only + `ArticleSearch`, top **4** articles, **1500** chars each; zero matches short-circuits the provider entirely.

The retrieval query is `PortalFaqController::index()`'s composition, verbatim in shape:

```php
$query = KbArticle::query()
    ->where('status', ArticleStatus::Published->value)
    ->whereNotNull('published_at')
    ->with('category');

$articles = $this->search->apply($query, $question)
    ->limit((int) config('ai.chat.grounding_articles'))
    ->get();
```

Both status clauses, always. `KbArticle::scopeVisibleTo()` is **forbidden** here — it takes a
`?User`, it is the staff boundary, and passing `null` only happens to work.

**`kb_articles` has no `locale` column** (verified: `2026_08_28_100100_create_kb_articles_table.php`).
Filtering grounding by the portal locale is impossible and is **not attempted**. Instead the system
prompt carries the answer language, derived from `app()->getLocale()`, which `SetLocale` sets from
the `Accept-Language` header `portalClient.ts:56-64` always sends. A `kb_articles.locale` migration
is a recorded deferral.

**Zero matching articles → do not call the provider.** Return the canned refusal
(`__('ai.chat_no_answer')`) with `state: "refused"` and `can_escalate: true`. Deterministic, free,
and testable without a fake response.

**Citations are never trusted.** The model returns slugs; the service intersects them with the
slugs it actually offered and emits `[{id, slug, title}]` for the survivors only. A hallucinated
slug is silently dropped. The SPA links each citation to `/portal/faq/{slug}` — an existing public
route.

### Decision 8 — Concrete guardrail numbers, all under `config('ai.chat')` and `config('ai.classify')`.

| Key | Default | Why |
|---|---|---|
| `ai.chat.enabled` | `true` | An independent kill switch that does not disable agent AI Assist. |
| `ai.chat.max_messages` | `20` | Customer + assistant rows combined ≈ 10 exchanges. Past that, a human should be involved. |
| `ai.chat.max_tokens_per_conversation` | `12000` | ~4 grounded turns of a 4×1500-char context on a free tier, with headroom. |
| `ai.chat.max_question_chars` | `1000` | Validation cap on one question; `description` elsewhere is 5000, but a chat turn is not a ticket. |
| `ai.chat.grounding_articles` | `4` | Decision 7. |
| `ai.chat.grounding_chars` | `1500` | Per article, via `Str::limit`. 4×1500 ≈ 1.5k tokens of context. |
| `ai.chat.history_turns` | `8` | Newest N stored messages replayed into the transcript — mirrors `ai.transcript_messages`. |
| `ai.chat.rate_per_minute` | `8` | The `portal-chat` limiter. Below the 60/min `portal` limiter it nests inside. |
| `ai.chat.rate_per_day` | `100` | Free-tier day budget per session. |
| `ai.chat.timeout` | `20` | Seconds. **Shorter than `ai.timeout` (30)** — a customer is waiting live. |
| `ai.classify.enabled` | `true` | Kill switch. |
| `ai.classify.min_confidence` | `0.6` | Decision 5. |
| `ai.classify.max_chars` | `2000` | Description clamp in the classify prompt. |
| `ai.classify.max_per_request` | `3` | Decision 2's process cap. |

`ai.chat.timeout` and `ai.classify` values are **read by the services, not by the generator** —
`OpenAiCompatibleAssistGenerator` reads `config('ai.timeout')` at `:39` and this story does not edit
it. The chat service applies its own budget by temporarily overriding `config(['ai.timeout' => …])`
around the call **— no.** That is a global mutation and is forbidden. Instead: `ai.chat.timeout` is
**declared in config and documented as not yet applied**, with a one-line comment saying the
generator owns the timeout and honouring a per-call budget requires the seam change Decision 1
rejected. Do not fake it.

### Decision 9 — Every new route joins an **existing** portal group; the new limiter is additive.

```php
Route::prefix('portal')->middleware(['portal', 'throttle:portal'])->group(function () {
    // … existing six …
    Route::get('/chat', [PortalChatController::class, 'show'])->name('portal.chat.show');
    Route::post('/chat/messages', [PortalChatController::class, 'store'])
        ->middleware('throttle:portal-chat')->name('portal.chat.store');
    Route::post('/chat/escalate', [PortalChatController::class, 'escalate'])->name('portal.chat.escalate');
});
```

`ApiContractTest.php:322-343` walks every `api/portal/*` route and requires `portal` (or a public
portal limiter) present and `auth:sanctum` absent. Nesting inside the existing group satisfies both
by construction. **A public chat route with only `throttle:portal-chat` would fail that test** —
do not create one.

The single agent-facing route is one line inside the existing `auth:sanctum` group, next to the
AI-Assist block at `routes/api.php:79-86`, and carries **no** `throttle:ai-assist` because it makes
no provider call:

```php
Route::delete('/tickets/{ticket}/ai-classification', [TicketClassificationController::class, 'destroy']);
```

### Decision 10 — The chat endpoint answers **200 with a `state`**, except rate limiting, which is the framework's 429.

`state` is `App\Enums\ChatReplyState`:

| `state` | HTTP | Trigger | SPA renders |
|---|---|---|---|
| `ok` | 200 | A grounded answer | the bubble + citations |
| `refused` | 200 | Model set `refused: true`, or zero grounding articles | the bubble + a prominent "Talk to a person" |
| `unavailable` | 200 | `AssistUnavailableException`, `ai.enabled`/`ai.chat.enabled` false, or unparseable JSON | a calm inline notice + retry + "Talk to a person" |
| `ended` | 200 | `max_messages` or `max_tokens_per_conversation` reached | composer disabled + "Talk to a person" |
| `rate_limited` | **429** | `throttle:portal-chat` | the same notice, with the `Retry-After` header |

Why 200-with-state and not the AI-Assist 503: the agent panel is an optional card that can vanish,
but the chat screen is the whole page. A 503 would trip `portalClient`'s error path and give the
customer a dead end. `rate_limited` is the exception because the limiter middleware answers before
the controller ever runs; the SPA maps HTTP 429 to that state itself. The enum still carries the
value so the two paths render one component.

An `AssistUnavailableException` is **caught in the service**, `report()`ed (never returned — the
provider's message can carry an `Authorization` header, per WIS-26 Decision 7), and turned into
`unavailable`. The customer's question is still stored, so retrying does not lose it; the failed
assistant turn is **not** stored and its tokens are not counted.

---

## Backend Tasks

### 1 — Extend `api/config/ai.php`

**File:** `api/config/ai.php`

Append two blocks **after** `transcript_chars` (the last entry, `:84`). Change nothing above it.

```php
    /*
     * Story 24 (WIS-23) — auto-classification. Runs from
     * TicketClassificationObserver on Ticket::created, deferred with
     * DB::afterCommit + app()->terminating() so the creating request never
     * waits on the provider.
     */
    'classify' => [
        'enabled' => (bool) env('AI_CLASSIFY_ENABLED', true),

        // Below this, the suggestion is DISCARDED and the ticket is flagged
        // needs_triage. Never applied automatically at any confidence —
        // see Decision 4.
        'min_confidence' => (float) env('AI_CLASSIFY_MIN_CONFIDENCE', 0.6),

        // Description clamp inside the classify prompt.
        'max_chars' => (int) env('AI_CLASSIFY_MAX_CHARS', 2000),

        // Per-process cap, mirroring mail.csat.max_per_request. There is no
        // queue worker, so an importer creating N tickets would otherwise do
        // N synchronous provider calls in one process.
        'max_per_request' => (int) env('AI_CLASSIFY_MAX_PER_REQUEST', 3),
    ],

    /*
     * Story 24 (WIS-23) — the Customer Portal chatbot. Grounded ONLY on
     * published KB articles; guardrails are enforced in PortalChatbot, not
     * by the model.
     */
    'chat' => [
        'enabled' => (bool) env('AI_CHAT_ENABLED', true),

        // Customer + assistant rows combined, per conversation.
        'max_messages' => (int) env('AI_CHAT_MAX_MESSAGES', 20),

        // Provider-reported prompt+completion tokens, accumulated per
        // conversation. A provider that reports 0 never trips this.
        'max_tokens_per_conversation' => (int) env('AI_CHAT_MAX_TOKENS', 12000),

        'max_question_chars' => (int) env('AI_CHAT_MAX_QUESTION_CHARS', 1000),

        // Top-N published articles fed into the CONTEXT block, and the
        // per-article character clamp.
        'grounding_articles' => (int) env('AI_CHAT_GROUNDING_ARTICLES', 4),
        'grounding_chars' => (int) env('AI_CHAT_GROUNDING_CHARS', 1500),

        // Newest N stored messages replayed into the transcript.
        'history_turns' => (int) env('AI_CHAT_HISTORY_TURNS', 8),

        'rate_per_minute' => (int) env('AI_CHAT_RATE_PER_MINUTE', 8),
        'rate_per_day' => (int) env('AI_CHAT_RATE_PER_DAY', 100),

        // DECLARED, NOT YET APPLIED. OpenAiCompatibleAssistGenerator reads
        // config('ai.timeout') (30s) at :39 and owns the HTTP budget; giving
        // one call a different budget needs a seam change this story
        // deliberately rejected (Decision 1). Do not mutate ai.timeout at
        // runtime to fake it.
        'timeout' => (int) env('AI_CHAT_TIMEOUT', 20),
    ],
```

### 2 — Register the `portal-chat` limiter

**File:** `api/bootstrap/app.php`

Insert directly after the `ai-assist` block (`:64-69`), inside the same `then:` closure:

```php
            // Story 24 (WIS-23): the portal chatbot's own limiter, keyed on
            // the portal bearer token like `portal` — never on the IP alone,
            // or one household NAT would share a budget. It NESTS inside
            // `throttle:portal` (60/min); both apply.
            RateLimiter::for('portal-chat', fn (Request $request) => [
                Limit::perMinute((int) config('ai.chat.rate_per_minute'))
                    ->by('portal-chat:'.($request->bearerToken() ?? $request->ip())),
                Limit::perDay((int) config('ai.chat.rate_per_day'))
                    ->by('portal-chat:'.($request->bearerToken() ?? $request->ip())),
            ]);
```

`config()` is read **inside** the closure, which runs per request, so `config:cache` is unaffected.

### 3 — Migration: classification columns on `tickets`

**Create file:** `api/database/migrations/2026_09_09_100000_add_ai_classification_to_tickets_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 24 (WIS-23), Decision 3. The AI classification lives on the ticket
 * row, not in ai_assist_artifacts: the queue must FILTER on needs_triage,
 * which a TEXT blob cannot do.
 *
 * NOTHING here writes tickets.category or tickets.priority — see Decision 4.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('ai_suggested_category', 32)->nullable();
            $table->string('ai_suggested_priority', 16)->nullable();
            // 0.00 … 1.00. Cast to float on the model — the `decimal` cast
            // returns a STRING, and pgsql returns numeric as a string over PDO.
            $table->decimal('ai_confidence', 3, 2)->nullable();
            // NULL means "never classified" (provider failure / feature off),
            // which is distinct from "classified and found ambiguous".
            $table->timestamp('ai_classified_at')->nullable();
            // 64 to match ai_assist_artifacts.model and the existing clamp at
            // OpenAiCompatibleAssistGenerator.php:82. Clamp, do not widen.
            $table->string('ai_classification_model', 64)->nullable();
            $table->boolean('needs_triage')->default(false);

            $table->index('needs_triage');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex(['needs_triage']);
            $table->dropColumn([
                'ai_suggested_category', 'ai_suggested_priority', 'ai_confidence',
                'ai_classified_at', 'ai_classification_model', 'needs_triage',
            ]);
        });
    }
};
```

### 4 — Migrations: the two chat tables

**Create file:** `api/database/migrations/2026_09_09_100100_create_portal_chat_conversations_table.php`

```php
Schema::create('portal_chat_conversations', function (Blueprint $table) {
    $table->id();
    // Keyed on the SESSION, not the customer: signing out ends the
    // conversation and its ceiling. Decision 6.
    $table->foreignId('portal_session_id')->constrained('portal_sessions')->cascadeOnDelete();
    $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
    $table->string('locale', 8);
    $table->string('state', 16)->default('active'); // App\Enums\PortalChatState
    $table->unsignedInteger('message_count')->default(0);
    // The PROVIDER's own reported counts, accumulated. No tokenizer here.
    $table->unsignedInteger('input_tokens')->default(0);
    $table->unsignedInteger('output_tokens')->default(0);
    $table->foreignId('escalated_ticket_id')->nullable()->constrained('tickets')->nullOnDelete();
    $table->timestamps();

    $table->index('portal_session_id');
});
```

**Create file:** `api/database/migrations/2026_09_09_100200_create_portal_chat_messages_table.php`

```php
Schema::create('portal_chat_messages', function (Blueprint $table) {
    $table->id();
    $table->foreignId('portal_chat_conversation_id')
        ->constrained('portal_chat_conversations')->cascadeOnDelete();
    $table->string('role', 16); // 'customer' | 'assistant'
    $table->text('body');
    // [{id, slug, title}] — only slugs that were actually OFFERED to the
    // model survive (Decision 7). Cast 'array'.
    $table->json('citations')->nullable();
    $table->unsignedInteger('input_tokens')->default(0);
    $table->unsignedInteger('output_tokens')->default(0);
    $table->timestamps();

    $table->index(['portal_chat_conversation_id', 'id']);
});
```

Both `json()` and `decimal()` are portable across pgsql and SQLite; no driver branch is needed
(unlike `2026_08_28_160000_create_csat_surveys_table.php`, which needed one for a CHECK constraint).

### 5 — Two enums

**Create file:** `api/app/Enums/PortalChatState.php`

```php
enum PortalChatState: string
{
    case Active = 'active';
    case Ended = 'ended';       // a ceiling was reached
    case Escalated = 'escalated'; // "talk to a person" created a ticket
}
```

**Create file:** `api/app/Enums/ChatReplyState.php`

```php
/**
 * Story 24 (WIS-23), Decision 10. The `state` key of every chat response.
 * `RateLimited` is never emitted by the controller — the throttle middleware
 * answers 429 first and the SPA maps that status to this value — but it lives
 * here so both paths render one component.
 */
enum ChatReplyState: string
{
    case Ok = 'ok';
    case Refused = 'refused';
    case Unavailable = 'unavailable';
    case Ended = 'ended';
    case RateLimited = 'rate_limited';
}
```

### 6 — `JsonAnswer`, the defensive parser

**Create file:** `api/app/Services/Ai/JsonAnswer.php`

```php
<?php

namespace App\Services\Ai;

/**
 * Story 24 (WIS-23), Decision 1. The seam returns TEXT; both new call kinds
 * ask the model for one JSON object. This is the only place that text is
 * turned into an array, and it NEVER throws — an unparseable answer is
 * information (low confidence / unavailable), not an exception.
 */
final class JsonAnswer
{
    /** @return array<string, mixed>|null */
    public static function parse(string $content): ?array
    {
        $text = trim($content);

        // Strip a ```json … ``` fence if the model added one anyway.
        if (str_starts_with($text, '```')) {
            $text = preg_replace('/^```[a-zA-Z]*\s*/', '', $text) ?? $text;
            $text = preg_replace('/\s*```$/', '', $text) ?? $text;
        }

        // Take the outermost object, so a stray "Here you go:" prefix or a
        // trailing sentence does not defeat the decode.
        $start = strpos($text, '{');
        $end = strrpos($text, '}');

        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        $decoded = json_decode(substr($text, $start, $end - $start + 1), true);

        return is_array($decoded) ? $decoded : null;
    }
}
```

### 7 — The classify prompt and the classifier

**Create file:** `api/app/Services/Ai/ClassificationPrompt.php`

Modelled on `AssistTranscript`: a `private const` system string, one public method returning
`[$system, $prompt]`, no HTTP.

```php
final class ClassificationPrompt
{
    private const SYSTEM = <<<'TXT'
You are a support-ticket triage classifier. You will be given one ticket's subject and description.

Reply with ONE JSON object and nothing else. No prose, no explanation, no markdown, no code fence.

The object has exactly these keys:
  "category"   - one of: general, billing, technical, account, feature_request
  "priority"   - one of: low, normal, high, urgent
  "confidence" - a number between 0 and 1: how confident you are that BOTH values above are correct
  "reason"     - at most 140 characters, in English, explaining the choice

Priority guidance. "urgent": a total outage, a security or data-loss incident, or money already
lost. "high": the customer is blocked and has no workaround. "normal": the default for a real
problem that is not blocking. "low": questions, feedback, and feature requests.

If the text is empty, too short, or unintelligible, still answer, but set "confidence" to 0.3 or
lower. Never output a category or priority that is not in the lists above. Never add keys.
TXT;

    /** @return array{0: string, 1: string} */
    public function forTicket(Ticket $ticket): array
    {
        $description = trim((string) $ticket->description);

        $prompt = implode("\n", [
            'Subject: '.$ticket->subject,
            'Channel: '.$ticket->channel->value,
            'Customer tier: '.($ticket->customer?->tier?->value ?? 'unknown'),
            '',
            $description === ''
                ? '(no description provided)'
                : Str::limit($description, (int) config('ai.classify.max_chars')),
        ]);

        return [self::SYSTEM, $prompt];
    }
}
```

The system prompt is **English-only and never localised** — its output is enum values, not prose,
and `AssistTranscript::localize()`'s Arabic sentence would only invite Arabic key names.

**Create file:** `api/app/Services/Ai/TicketClassifier.php`

```php
final class TicketClassifier
{
    public function __construct(
        private AssistGenerator $generator,
        private ClassificationPrompt $prompt,
    ) {}

    /**
     * Classify $ticket and persist the result. NEVER writes category or
     * priority (Decision 4). Returns true when a row was written.
     */
    public function classify(Ticket $ticket): bool
    {
        if (! config('ai.enabled') || ! config('ai.classify.enabled')) {
            return false;
        }

        [$system, $prompt] = $this->prompt->forTicket($ticket->loadMissing('customer'));

        try {
            $result = $this->generator->generate($system, $prompt);
        } catch (AssistUnavailableException $e) {
            // Decision 5, row 3: the ticket is COMPLETELY unaffected —
            // ai_classified_at stays null. report(), never rethrow: this runs
            // in a terminating callback, after the response was sent.
            report($e);

            return false;
        }

        $data = JsonAnswer::parse($result->content) ?? [];

        $category = is_string($data['category'] ?? null) ? $data['category'] : null;
        $priority = is_string($data['priority'] ?? null) ? $data['priority'] : null;
        $confidence = is_numeric($data['confidence'] ?? null) ? (float) $data['confidence'] : 0.0;
        $confidence = max(0.0, min(1.0, $confidence));

        $valid = in_array($category, Ticket::CATEGORIES, true)
            && Priority::tryFrom((string) $priority) !== null;

        $confident = $valid && $confidence >= (float) config('ai.classify.min_confidence');

        // A BASE-builder update: an Eloquent update would fire Ticket::booted()
        // and TicketResolutionObserver for something that is not a lifecycle
        // event. Same discipline as PortalFaqController::show():57.
        Ticket::query()->whereKey($ticket->id)->toBase()->update([
            'ai_suggested_category' => $confident ? $category : null,
            'ai_suggested_priority' => $confident ? $priority : null,
            'ai_confidence' => $confidence,
            'ai_classified_at' => now(),
            'ai_classification_model' => Str::limit($result->model, 64, ''),
            'needs_triage' => ! $confident,
            'updated_at' => $ticket->updated_at,   // do NOT bump the queue's sort key
        ]);

        return true;
    }
}
```

**`updated_at` is pinned deliberately.** The default ticket sort is `latest('tickets.created_at')`
but `scopeSorted()` offers `updated_at`, and the portal's open list orders by it
(`PortalRequestController::index():51`). A background classification must not reorder a customer's
list.

### 8 — The observer

**Create file:** `api/app/Observers/TicketClassificationObserver.php`

Structure copied from `TicketResolutionObserver`:

```php
class TicketClassificationObserver
{
    /** Per-process cap, exactly like TicketResolutionObserver::$sentThisRequest:39. */
    private static int $classifiedThisRequest = 0;

    public static function resetClassificationCounter(): void
    {
        self::$classifiedThisRequest = 0;
    }

    public function created(Ticket $ticket): void
    {
        if (! config('ai.enabled') || ! config('ai.classify.enabled')) {
            return;
        }

        // `migrate:fresh --seed` creates 64 tickets in ONE process; without
        // this the console kernel's terminate would fire 64 provider calls.
        if (app()->runningInConsole()) {
            return;
        }

        $cap = (int) config('ai.classify.max_per_request');

        if (++self::$classifiedThisRequest > $cap) {
            Log::warning('AI classification skipped: per-request cap reached.', [
                'ticket_id' => $ticket->id,
                'cap' => $cap,
            ]);

            return;
        }

        $id = $ticket->id;

        // afterCommit: TicketController@store runs OUTSIDE a transaction
        // (:91) but PortalRequestController::store() runs INSIDE one (:107).
        // terminating: run after $response->send(), so no caller waits on the
        // provider. Laravel's test kernel calls terminate(), so this IS
        // exercised by feature tests.
        DB::afterCommit(function () use ($id) {
            app()->terminating(function () use ($id) {
                try {
                    $fresh = Ticket::query()->find($id);

                    if ($fresh !== null) {
                        app(TicketClassifier::class)->classify($fresh);
                    }
                } catch (Throwable $e) {
                    // Nothing downstream of a sent response may 500.
                    Log::error('AI classification failed.', [
                        'ticket_id' => $id,
                        'exception' => $e::class,
                    ]);
                }
            });
        });
    }
}
```

Note it re-`find()`s by **id** rather than closing over the model: by terminate time the request's
model instance is stale, and a ticket deleted in the same request must not be resurrected.

**File:** `api/app/Providers/AppServiceProvider.php` — register it beside the existing observer at
`:113`:

```php
        // Story 24 (WIS-23): propose category + priority on create. Writes ONLY
        // the ai_suggested_* columns — never category/priority (Decision 4).
        Ticket::observe(TicketClassificationObserver::class);
```

**File:** `api/tests/TestCase.php` — add after the CSAT reset at `:16`:

```php
        TicketClassificationObserver::resetClassificationCounter();
```

### 9 — Model, resource and filter changes on `Ticket`

**File:** `api/app/Models/Ticket.php`

- Append to `$fillable` (`:21-31`) — a new `// Story 24 (WIS-23)` comment line, then
  `'ai_suggested_category', 'ai_suggested_priority', 'ai_confidence', 'ai_classified_at',
  'ai_classification_model', 'needs_triage',`.
- Append to `casts()`: `'ai_classified_at' => 'datetime'`, `'ai_confidence' => 'float'`,
  `'needs_triage' => 'boolean'`. **`float`, not `decimal:2`** — Decision 3.
- Add after `scopeFilter()`:

```php
    /** Story 24 (WIS-23). Tickets the AI could not classify confidently. */
    public function scopeNeedsTriage(Builder $query): Builder
    {
        return $query->where('needs_triage', true);
    }
```

- Inside `scopeFilter()` (`:118-140`), add one `when()` clause after the `category` line:

```php
            ->when($filters['needs_triage'] ?? null, fn ($q) => $q->where('needs_triage', true))
```

**File:** `api/app/Http/Controllers/TicketController.php`

- In `index()`'s `$filters` array (`:41-49`), add
  `'needs_triage' => $request->boolean('needs_triage') ?: null,`.
- In `update()` (`:126-192`), after `$data = $request->validated();`, add:

```php
        // Story 24 (WIS-23), Decision 4. A human touching either classified
        // field IS the triage decision — whether they applied the suggestion
        // or typed their own. Ticket::booted() already audits the change.
        if (array_key_exists('category', $data) || array_key_exists('priority', $data)) {
            $data['needs_triage'] = false;
        }
```

**File:** `api/app/Http/Resources/TicketResource.php` — append one key **after** `category_label`,
before `channel`. Appending a key is additive; every existing consumer is unaffected.

```php
            // Story 24 (WIS-23). null when the ticket was never classified
            // (provider failure or the feature off) — which is distinct from
            // classified-but-ambiguous, where `suggestion` is null and
            // `needs_triage` is true.
            'ai_classification' => $this->ai_classified_at === null ? null : [
                'suggested_category' => $this->ai_suggested_category,
                'suggested_category_label' => $this->ai_suggested_category
                    ? Ticket::categoryLabel($this->ai_suggested_category) : null,
                'suggested_priority' => $this->ai_suggested_priority,
                'suggested_priority_label' => $this->ai_suggested_priority
                    ? Priority::from($this->ai_suggested_priority)->label() : null,
                'confidence' => $this->ai_confidence,
                'needs_triage' => (bool) $this->needs_triage,
                'classified_at' => $this->ai_classified_at,
            ],
```

`use App\Enums\Priority;` is added to the resource's imports.

### 10 — The dismiss endpoint

**Create file:** `api/app/Http/Controllers/TicketClassificationController.php`

```php
/**
 * Story 24 (WIS-23). The "ignore this suggestion" half of Decision 4. There is
 * no APPLY endpoint: applying is PATCH /api/tickets/{id} with the suggested
 * values, which already runs TicketPolicy@update and already writes
 * category_changed / priority_changed to ticket_events.
 */
class TicketClassificationController extends Controller
{
    use AuthorizesRequests;

    public function destroy(Ticket $ticket): JsonResponse
    {
        $this->authorize('update', $ticket);

        Ticket::query()->whereKey($ticket->id)->toBase()->update([
            'ai_suggested_category' => null,
            'ai_suggested_priority' => null,
            'needs_triage' => false,
            'updated_at' => $ticket->updated_at,
        ]);

        return response()->json([], 204);
    }
}
```

`ai_confidence` and `ai_classified_at` survive dismissal — the ticket *was* classified, and nulling
them would make it eligible for a future re-classification sweep it should not be eligible for.

**File:** `api/routes/api.php` — one line inside the `auth:sanctum` group, after the AI-Assist block
(`:86`), plus the `use` import.

### 11 — KB grounding

**Create file:** `api/app/Services/Ai/KbGrounding.php`

```php
/**
 * Story 24 (WIS-23), Decision 7. The ONLY source of chatbot ground truth:
 * PUBLISHED KB articles. Reuses the ArticleSearch contract (Story 09) and the
 * exact published-only pair PortalFaqController::index():27-29 uses.
 *
 * KbArticle::scopeVisibleTo() is deliberately NOT used — it takes a ?User and
 * is the STAFF boundary. A portal caller has no User.
 */
final class KbGrounding
{
    public function __construct(private ArticleSearch $search) {}

    /** @return Collection<int, KbArticle> */
    public function forQuestion(string $question): Collection
    {
        $term = trim($question);

        if ($term === '') {
            return collect();
        }

        $query = KbArticle::query()
            ->where('status', ArticleStatus::Published->value)
            ->whereNotNull('published_at');

        return $this->search->apply($query, $term)
            ->limit((int) config('ai.chat.grounding_articles'))
            ->get();
    }

    /** The CONTEXT block. Empty collection => empty string; the caller short-circuits. */
    public function render(Collection $articles): string
    {
        return $articles->map(fn (KbArticle $a) => sprintf(
            "[[article: %s]] %s\n%s",
            $a->slug,
            $a->title,
            Str::limit(strip_tags((string) ($a->body ?? $a->excerpt ?? '')),
                (int) config('ai.chat.grounding_chars'))
        ))->implode("\n\n");
    }

    /** @return array<int, array{id: int, slug: string, title: string}> */
    public function citations(Collection $offered, array $slugs): array
    {
        // NEVER trust the model's slugs — intersect with what was offered.
        return $offered
            ->filter(fn (KbArticle $a) => in_array($a->slug, $slugs, true))
            ->map(fn (KbArticle $a) => ['id' => $a->id, 'slug' => $a->slug, 'title' => $a->title])
            ->values()->all();
    }
}
```

`$a->body` is raw Markdown; `strip_tags` is belt-and-braces for any HTML that leaked in.
`body_html` is deliberately **not** used — the model does not need markup.

### 12 — The chat prompt

**Create file:** `api/app/Services/Ai/ChatPrompt.php`

```php
final class ChatPrompt
{
    private const SYSTEM = <<<'TXT'
You are the Wisal support assistant on a customer self-service portal. You answer ONLY from the
knowledge-base articles supplied in the CONTEXT block of the user message.

Rules, in priority order:
1. If the CONTEXT does not contain the answer, do not guess and do not use outside knowledge. Put a
   short sentence in "answer" saying you could not find it, and set "refused" to true.
2. Never state a price, policy, date, refund, deadline, or account fact that is not written in the
   CONTEXT.
3. Never ask for, repeat, or confirm a password, a card number, or a verification code.
4. Answer in {LANGUAGE}. Under 120 words. Plain prose. No markdown, no headings, no bullet points.
5. List the slug of every article you used in "citations". Use only slugs that appear in the
   CONTEXT block.

Reply with ONE JSON object and nothing else. No prose outside it, no markdown, no code fence.
The object has exactly these keys:
  "answer"    - the text to show the customer
  "citations" - an array of article slugs you used; may be empty
  "refused"   - true when you could not answer from the CONTEXT, otherwise false
TXT;

    /** @return array{0: string, 1: string} */
    public function build(string $context, Collection $history, string $question, string $locale): array
    {
        $system = str_replace('{LANGUAGE}', $locale === 'ar' ? 'Arabic' : 'English', self::SYSTEM);

        $lines = ['CONTEXT', $context, 'END CONTEXT', '', 'CONVERSATION'];

        foreach ($history as $message) {
            $lines[] = ($message->role === PortalChatMessage::ROLE_CUSTOMER ? 'Customer: ' : 'Assistant: ')
                .$message->body;
        }

        $lines[] = 'Customer: '.$question;

        return [$system, implode("\n", $lines)];
    }
}
```

### 13 — Models

**Create file:** `api/app/Models/PortalChatConversation.php` — `$fillable` for every column except
`id`/timestamps; `casts()` with `'state' => PortalChatState::class`; `belongsTo` `PortalSession`,
`Customer`, and `Ticket` (as `escalatedTicket`); `hasMany` `PortalChatMessage` ordered
`orderBy('id')` (mirroring `Ticket::messages():98`); and:

```php
    public function totalTokens(): int
    {
        return $this->input_tokens + $this->output_tokens;
    }

    /** Decision 8's two ceilings, checked BEFORE the provider is called. */
    public function hasCapacity(): bool
    {
        return $this->message_count < (int) config('ai.chat.max_messages')
            && $this->totalTokens() < (int) config('ai.chat.max_tokens_per_conversation');
    }
```

**Create file:** `api/app/Models/PortalChatMessage.php` — `public const ROLE_CUSTOMER = 'customer';`
and `ROLE_ASSISTANT = 'assistant';` (mirroring `TicketMessage::AUTHOR_CUSTOMER`), `$fillable`,
`casts()` with `'citations' => 'array'`, `belongsTo` the conversation.

### 14 — `PortalChatbot`, the service that owns every guardrail

**Create file:** `api/app/Services/Ai/PortalChatbot.php`

```php
final class PortalChatbot
{
    public function __construct(
        private AssistGenerator $generator,
        private KbGrounding $grounding,
        private ChatPrompt $prompt,
    ) {}

    /** The live conversation for this session, or null. Never creates. */
    public function existing(PortalSession $session): ?PortalChatConversation { … }

    /** The live conversation, created on first use. */
    public function conversationFor(PortalSession $session, string $locale): PortalChatConversation
    {
        return PortalChatConversation::firstOrCreate(
            ['portal_session_id' => $session->id, 'state' => PortalChatState::Active->value],
            ['customer_id' => $session->customer_id, 'locale' => $locale],
        );
    }

    /** @return array{state: ChatReplyState, message: ?PortalChatMessage} */
    public function ask(PortalChatConversation $conversation, string $question): array
    {
        // 1. Ceilings FIRST — before storing anything and before the provider.
        if ($conversation->state !== PortalChatState::Active || ! $conversation->hasCapacity()) {
            $conversation->update(['state' => PortalChatState::Ended->value]);

            return ['state' => ChatReplyState::Ended, 'message' => null];
        }

        // 2. Feature gates.
        if (! config('ai.enabled') || ! config('ai.chat.enabled')) {
            return ['state' => ChatReplyState::Unavailable, 'message' => null];
        }

        // 3. Store the question. It survives every downstream failure so a
        //    retry never loses what the customer typed.
        $this->append($conversation, PortalChatMessage::ROLE_CUSTOMER, $question, [], 0, 0);

        // 4. Ground. Zero articles => canned refusal, NO provider call.
        $articles = $this->grounding->forQuestion($question);

        if ($articles->isEmpty()) {
            $reply = $this->append(
                $conversation, PortalChatMessage::ROLE_ASSISTANT,
                __('ai.chat_no_answer'), [], 0, 0
            );

            return ['state' => ChatReplyState::Refused, 'message' => $reply];
        }

        // 5. Call.
        $history = $conversation->messages()
            ->where('id', '<', $conversation->messages()->max('id'))
            ->reorder('id', 'desc')
            ->limit((int) config('ai.chat.history_turns'))
            ->get()->sortBy('id')->values();

        [$system, $transcript] = $this->prompt->build(
            $this->grounding->render($articles), $history, $question, $conversation->locale
        );

        try {
            $result = $this->generator->generate($system, $transcript);
        } catch (AssistUnavailableException $e) {
            report($e); // the provider's reason is LOGGED, never returned

            return ['state' => ChatReplyState::Unavailable, 'message' => null];
        }

        $data = JsonAnswer::parse($result->content);

        if ($data === null || ! is_string($data['answer'] ?? null) || trim($data['answer']) === '') {
            report(new AssistUnavailableException('unparseable chat answer'));

            return ['state' => ChatReplyState::Unavailable, 'message' => null];
        }

        $refused = (bool) ($data['refused'] ?? false);
        $slugs = array_values(array_filter((array) ($data['citations'] ?? []), 'is_string'));
        $citations = $refused ? [] : $this->grounding->citations($articles, $slugs);

        $reply = $this->append(
            $conversation, PortalChatMessage::ROLE_ASSISTANT, trim($data['answer']),
            $citations, $result->inputTokens, $result->outputTokens
        );

        return [
            'state' => $refused ? ChatReplyState::Refused : ChatReplyState::Ok,
            'message' => $reply,
        ];
    }
}
```

`append()` is a private helper that creates the `PortalChatMessage` **and** increments the
conversation's `message_count` / `input_tokens` / `output_tokens` in the same
`DB::transaction`, so a conversation's counters can never drift from its rows.

**A failed turn stores no assistant message and counts no tokens** (Decision 10) — the customer's
question is already stored, so the SPA shows it with an inline notice beneath.

### 15 — Escalation: "Talk to a person"

Also on `PortalChatbot`:

```php
    /**
     * Decision: this is PortalRequestController::store() (:104-150) with the
     * TRANSCRIPT as the body source. Same transaction, same assigner, same
     * SlaClock ordering, same description-becomes-first-message rule.
     */
    public function escalate(PortalChatConversation $conversation, Customer $customer): Ticket
    {
        $ticket = DB::transaction(function () use ($conversation, $customer) {
            $body = $this->renderTranscript($conversation);

            $data = [
                'subject' => Str::limit($conversation->messages()
                    ->where('role', PortalChatMessage::ROLE_CUSTOMER)
                    ->orderBy('id')->value('body') ?? __('ai.chat_escalation_subject'), 120, ''),
                'description' => $body,
                'customer_id' => $customer->id,
                'created_by' => null,
                'status' => TicketStatus::Open->value,
                // The chatbot is a chat channel. The enum already has it.
                'channel' => Channel::Chat->value,
                // Explicit, not left to the column default — SlaClock::applyTo()
                // needs a real Priority instance (PortalRequestController:114-118).
                'priority' => Priority::Normal->value,
                'category' => 'general',
            ];

            $picked = app(TicketAssigner::class)->pick();
            if ($picked !== null) { $data['assigned_to'] = $picked->id; }

            $ticket = Ticket::create($data);
            app(SlaClock::class)->applyTo($ticket);
            $ticket->save();

            if ($picked !== null) { $ticket->recordAutoAssigned($ticket->assigned_to); }

            // The transcript IS the first message, matching both existing
            // store() paths (TicketController:107-114, PortalRequest:139-146).
            $ticket->messages()->create([
                'author_type' => TicketMessage::AUTHOR_CUSTOMER,
                'user_id' => null,
                'customer_id' => $customer->id,
                'channel' => Channel::Chat->value,
                'body' => $body,
                'visibility' => MessageVisibility::Public->value,
            ]);

            $conversation->update([
                'state' => PortalChatState::Escalated->value,
                'escalated_ticket_id' => $ticket->id,
            ]);

            return $ticket;
        });

        return $ticket;
    }
```

`renderTranscript()` produces, with a localised header from `api/lang/{en,ar}/ai.php`:

```
[Chat transcript]
Customer: …
Assistant: …
Customer: …
```

with each body clamped to 2000 characters and the whole thing to **5000**, matching
`StorePortalRequestRequest`'s `description` max so the value is never longer than a human could have
typed.

The subject is the customer's **first** question, clamped to 120 characters, falling back to a
localised "Chat transcript" when the conversation somehow has none.

**Escalating an empty conversation is a 422**, not a ticket — see Edge Cases.

Note: this `Ticket::create()` fires `TicketClassificationObserver` too, which is intended — an
escalated conversation is exactly the kind of ticket triage helps with. It counts against the
per-request cap.

### 16 — `PortalChatController`

**Create file:** `api/app/Http/Controllers/Portal/PortalChatController.php`

Three actions. Every one resolves identity through `PortalRequest`, never `$request->user()`.

```php
class PortalChatController extends Controller
{
    public function __construct(private PortalChatbot $bot) {}

    /** GET /api/portal/chat — the live conversation and its messages, or an empty shell. */
    public function show(Request $request): JsonResponse
    {
        $session = PortalRequest::session($request);
        $conversation = $this->bot->existing($session);

        return response()->json([
            'enabled' => (bool) (config('ai.enabled') && config('ai.chat.enabled')),
            'conversation' => $conversation
                ? (new PortalChatConversationResource($conversation))->resolve() : null,
            'messages' => $conversation
                ? PortalChatMessageResource::collection($conversation->messages)->resolve() : [],
        ]);
    }

    /** POST /api/portal/chat/messages */
    public function store(StorePortalChatMessageRequest $request): JsonResponse
    {
        $session = PortalRequest::session($request);
        $conversation = $this->bot->conversationFor($session, app()->getLocale());

        ['state' => $state, 'message' => $message] =
            $this->bot->ask($conversation, $request->validated('body'));

        return response()->json([
            'state' => $state->value,
            'conversation' => (new PortalChatConversationResource($conversation->refresh()))->resolve(),
            'message' => $message ? (new PortalChatMessageResource($message))->resolve() : null,
        ]);
    }

    /** POST /api/portal/chat/escalate */
    public function escalate(Request $request): JsonResponse
    {
        $session = PortalRequest::session($request);
        $customer = PortalRequest::customer($request);
        $conversation = $this->bot->existing($session);

        abort_if($conversation === null || $conversation->message_count === 0, 422,
            __('ai.chat_escalation_empty'));

        $ticket = $this->bot->escalate($conversation, $customer);
        $ticket->loadCount(['messages' => fn ($q) => $q->publicOnly()]);

        return response()->json([
            'conversation' => (new PortalChatConversationResource($conversation->refresh()))->resolve(),
            'ticket' => (new PortalTicketResource($ticket))->resolve(),
        ], 201);
    }
}
```

Unwrapped bodies (`->resolve()`), matching `PortalRequestController`'s ticket endpoints.

**Create file:** `api/app/Http/Requests/StorePortalChatMessageRequest.php` — `authorize(): true`
(PortalAuth is the gate, exactly as `StorePortalRequestRequest:17-20` documents), rules:

```php
        return [
            'body' => ['required', 'string', 'max:'.(int) config('ai.chat.max_question_chars')],
        ];
```

**Create files:** `api/app/Http/Resources/PortalChatConversationResource.php`:

```
id, state, message_count, messages_remaining, tokens_remaining,
escalated_ticket_id, created_at
```

`messages_remaining` = `max(0, config('ai.chat.max_messages') - message_count)`;
`tokens_remaining` = `max(0, config('ai.chat.max_tokens_per_conversation') - totalTokens())`.
Both are computed server-side so the SPA never re-derives a ceiling.

…and `api/app/Http/Resources/PortalChatMessageResource.php`:

```
id, role, body, citations (array of {id, slug, title}), created_at
```

### 17 — Routes

**File:** `api/routes/api.php` — the three lines of Decision 9 inside the existing session group
(after `:315`), plus `use App\Http\Controllers\Portal\PortalChatController;` and the single agent
`DELETE` line of Task 10.

### 18 — Language lines

**File:** `api/lang/en/ai.php` — append (keep `unavailable` and `failed` untouched):

```php
    // Story 24 (WIS-23) — the chatbot.
    'chat_no_answer' => "I couldn't find an answer to that in our help articles. A member of the team can pick this up for you.",
    'chat_unavailable' => 'The assistant is unavailable right now. You can still send this to a person.',
    'chat_ended' => 'This conversation has reached its limit. A member of the team can take it from here.',
    'chat_escalation_empty' => 'Ask a question first, or submit a request instead.',
    'chat_escalation_subject' => 'Chat transcript',
    'chat_transcript_header' => 'Chat transcript',
    'chat_transcript_customer' => 'Customer',
    'chat_transcript_assistant' => 'Assistant',
```

**File:** `api/lang/ar/ai.php` — the identical key set, translated. The two files must stay key-identical.

### 19 — `ai:smoke` gains two kinds

**File:** `api/app/Console/Commands/AiSmokeCommand.php`

Change the signature to `{--kind=summary : summary|reply|classify|chat}` and add
`{--question= : the customer question, for --kind=chat}`. Add two branches to `handle()` **before**
the existing `AssistTranscript` branch:

- `classify` — resolve the ticket the same way, build the prompt with `ClassificationPrompt`, call
  the generator, print the raw content **and** `JsonAnswer::parse()`'s decoded array.
- `chat` — take `--question` (required for this kind), run `KbGrounding::forQuestion()`, print how
  many articles were found and their slugs, build with `ChatPrompt`, call, print the raw content and
  the parsed array.

Both branches resolve `AssistGenerator` from the container, like the existing code at `:53`, so they
prove the real binding. **Neither writes to the database** — `ai:smoke` stays read-only, which is
why classification is done through `ClassificationPrompt` directly rather than through
`TicketClassifier`.

### 20 — `.env.example` and README

**File:** `api/.env.example` — extend the Story 22 AI block (`:67-84`) with a Story 24 sub-block
listing every key from Task 1 with its default, commented as "all optional; the defaults in
`config/ai.php` are the ones the tests assert".

**File:** `README.md` — update three anchors, do not invent a new section:

1. The **Category 7** row of the requirements table (`README.md:182`) — it currently says the
   category is partial; auto-classification and the chatbot are now present.
2. The **"AI features are partial"** bullet under *12. Known gaps* (`README.md:762`) — remove or
   rewrite it, and replace it with the honest remaining gap: grounding is lexical
   (`ArticleSearch`), not semantic, and KB articles have no locale.
3. The **Run it** / feature-tour section — add `/portal/chat` to the portal walkthrough and
   `php artisan ai:smoke --kind=classify|chat --question="…"` beside the existing `ai:smoke` lines.

---

## Frontend Tasks

### 21 — Portal chat model + API

**Create file:** `web/src/features/portal/model/portalChat.ts`

```ts
export type ChatReplyState = 'ok' | 'refused' | 'unavailable' | 'ended' | 'rate_limited';

export type ChatCitation = { id: number; slug: string; title: string };

export type PortalChatMessage = {
  id: number;
  role: 'customer' | 'assistant';
  body: string;
  citations: ChatCitation[] | null;
  created_at: string;
};

export type PortalChatConversation = {
  id: number;
  state: 'active' | 'ended' | 'escalated';
  message_count: number;
  messages_remaining: number;
  tokens_remaining: number;
  escalated_ticket_id: number | null;
  created_at: string;
};

export type PortalChatView = {
  enabled: boolean;
  conversation: PortalChatConversation | null;
  messages: PortalChatMessage[];
};

export type PortalChatReply = {
  state: ChatReplyState;
  conversation: PortalChatConversation;
  message: PortalChatMessage | null;
};
```

**File:** `web/src/features/portal/api/portalApi.ts` — three functions appended, all on
`portalClient` (never `web/src/lib/api.ts`):

```ts
export function fetchPortalChat() { … GET '/portal/chat' … }
export function sendPortalChatMessage(body: string) { … POST '/portal/chat/messages' … }
export function escalatePortalChat() { … POST '/portal/chat/escalate' … }
```

**File:** `web/src/features/portal/model/portalKeys.ts` — add a `chat` key following the existing
factory's shape.

### 22 — `usePortalChat`

**Create file:** `web/src/features/portal/hooks/usePortalChat.ts`

A `useQuery` for `fetchPortalChat` plus a `useMutation` for `sendPortalChatMessage` that, on
success, writes the returned `conversation` + `message` into the query cache and stores the returned
`state`; and on error inspects `axios.isAxiosError(e) && e.response?.status === 429` to set the
state to `'rate_limited'` (Decision 10's one client-side mapping). A second mutation wraps
`escalatePortalChat` and invalidates both the chat key and the requests key.

### 23 — The chat screen

**Create files** under `web/src/features/portal/`:

- `components/ChatBubble.tsx` — one message; reuses `portal.css`'s bubble classes from
  `components/MessageBubble.tsx` rather than inventing new ones. `role === 'assistant'` renders an
  assistant-side bubble.
- `components/ChatCitations.tsx` — a list of `<Link to={`/portal/faq/${slug}`}>{title}</Link>`.
  **This is Done Criterion 3's visible half.**
- `components/ChatComposer.tsx` — textarea + send button; `disabled` when the conversation state is
  not `active`, when a send is in flight, or when the reply state is `ended`/`rate_limited`.
- `components/ChatNotice.tsx` — one component switching on `ChatReplyState`, rendering the
  `unavailable` / `ended` / `rate_limited` copy plus the "Talk to a person" button.
- `pages/PortalChatPage.tsx` — composes the above, and ships **all four async states** using
  `PortalSkeleton` / `PortalEmpty` / `PortalError` from `components/PortalStates.tsx` (the design
  brief's mandatory rule, `PortalStates.tsx:5-8`). On a successful escalation it navigates to
  `/portal/requests/{escalated_ticket_id}`.

**File:** `web/src/features/portal/index.ts` — export `PortalChatPage`.

**File:** `web/src/App.tsx` — one route inside `<RequirePortalSession />`, beside `history`:

```tsx
                  <Route path="chat" element={<PortalChatPage />} />
```

**Files:** `web/src/features/portal/pages/PortalRequestsPage.tsx` and `pages/PortalFaqPage.tsx` —
add a link to `/portal/chat` using an existing `portal-link` class. The FAQ page's link is the
discovery path for a customer who searched and found nothing.

**Files:** `web/src/i18n/locales/en/portal.json` and `.../ar/portal.json` — a new `chat` block:

```
chat.title, chat.intro, chat.placeholder, chat.send, chat.sending,
chat.you, chat.assistant, chat.sources, chat.empty, chat.loading, chat.error,
chat.unavailable, chat.ended, chat.rateLimited, chat.talkToPerson,
chat.escalating, chat.escalated, chat.escalateEmpty, chat.remaining
```

Both catalogues must carry the **identical** key set — `catalogueParity.test.ts` enforces it — and
every visible string must come from here, or `npm run lint`'s `check-no-literals.mjs` fails.

### 24 — The agent-side suggestion chip

**File:** `web/src/features/tickets/model/ticket.ts` — add to the `Ticket` type:

```ts
export type TicketAiClassification = {
  suggested_category: string | null;
  suggested_category_label: string | null;
  suggested_priority: TicketPriority | null;
  suggested_priority_label: string | null;
  confidence: number | null;
  needs_triage: boolean;
  classified_at: string;
};
```
and `ai_classification: TicketAiClassification | null;`.

**File:** `web/src/features/tickets/components/thread/ClassificationCard.tsx` — below the two
existing chips, render (only when `ticket.ai_classification !== null`):

- when `needs_triage` is true — a "Needs triage" pill and the localised "The assistant wasn't
  confident enough to suggest anything" line, with a **Dismiss** button.
- when a suggestion exists **and differs from the live values** — a suggestion row showing
  `suggested_category_label` / `suggested_priority_label` and the confidence as a percentage, with
  **Apply** and **Dismiss** buttons.
- when a suggestion exists and matches the live values — nothing. The agent already agrees.

**Apply** calls the existing `useTicketAttributeMutation(ticket.id)` (already imported by
`TicketMetaPanel.tsx:10`) with `{ category, priority }` — **that is the whole apply path**
(Decision 4). **Dismiss** calls a new `dismissClassification(ticketId)` in
`web/src/features/tickets/api/ticketsApi.ts` (`DELETE /api/tickets/{id}/ai-classification`) and
invalidates `ticketKeys.all`, per the index's one-keying-scheme rule.

**File:** `web/src/features/tickets/components/thread/ActivityList.tsx` — nothing required
(`activity.generic` covers any new event value), and this story adds no new `ticket_events` value:
applying a suggestion produces the existing `category_changed` / `priority_changed` rows. **Do not
add an `ai_classified` event** — the classification is not a lifecycle change and `ticket_events`
stays the human-action history.

**Files:** `web/src/i18n/locales/{en,ar}/conversation.json` — a `classification.*` block:
`classification.suggested`, `.apply`, `.dismiss`, `.confidence`, `.needsTriage`, `.notConfident`,
`.applying`.

---

## Edge Cases & Failure Modes

1. **`migrate:fresh --seed` must make ZERO provider calls.** `TicketScenarioSeeder` creates 64
   tickets in one process; without `app()->runningInConsole()` in
   `TicketClassificationObserver::created()` the console kernel's terminate would fire 64 calls.
   **Verify by running the seeder with a live key and watching for silence**, the same way WIS-27
   verified its Edge Case 13.
2. **A rolled-back ticket create must not classify.** `PortalRequestController::store()` wraps
   everything in `DB::transaction`; `DB::afterCommit` is what makes the rollback case correct.
   Enforced in `TicketClassificationObserver::created()`.
3. **A provider failure must leave the ticket byte-identical.** `TicketClassifier::classify()`
   returns `false` from the `catch` **before** any write, so `ai_classified_at` stays null. Done
   Criterion 6's first half.
4. **The model returns a category outside `Ticket::CATEGORIES`** (e.g. `"Billing"` capitalised, or
   `"refund"`). `in_array(..., true)` fails → treated as low confidence → `needs_triage = true`,
   suggestions null. Never a partial suggestion.
5. **The model returns prose instead of JSON.** `JsonAnswer::parse()` returns `null` → confidence
   `0.0` → `needs_triage`. For chat, `null` → `ChatReplyState::Unavailable` and no stored assistant
   message.
6. **The model wraps the JSON in a ```` ```json ```` fence, or prefixes "Here you go:".** Handled by
   the fence strip and the first-`{`/last-`}` substring in `JsonAnswer::parse()`.
7. **A confidence outside `[0,1]`** (`95` meaning 95%). Clamped with `max(0.0, min(1.0, …))`; `95`
   becomes `1.0`, which is confident. Accepted — a model that says 95 means confident.
8. **Classification must not reorder the ticket queue.** The update pins `updated_at` to its prior
   value. Without it, every new ticket would jump the `-updated_at` sort and the portal's open list
   (`PortalRequestController::index():51`) a second after creation.
9. **A ticket deleted between create and terminate.** The callback re-`find()`s by id and returns
   when null.
10. **Two portal tabs open at once.** `conversationFor()` uses `firstOrCreate` on
    `(portal_session_id, state='active')`; both tabs land on the same conversation, so the ceiling
    cannot be doubled. A race that inserts two rows is benign — the second `firstOrCreate` finds the
    first row on the next request.
11. **Signing out and back in resets the ceiling.** By design (Decision 6): a new
    `portal_sessions` row is a new conversation. The `portal-chat` per-day limiter is keyed on the
    bearer token, so a new token also resets that — the mitigation is `rate_per_day` being
    generous rather than a per-customer key, which would need a customer-keyed limiter and a
    `Customer` lookup in the limiter closure. **Recorded as a known limitation, not fixed here.**
12. **A revoked or expired session with a stored conversation.** `PortalAuth` 401s before the
    controller; the conversation rows remain and are unreachable. `cascadeOnDelete` on
    `portal_session_id` cleans them up if a session row is ever deleted.
13. **Zero published KB articles in the whole database.** Every question short-circuits to the
    canned refusal with `can_escalate`. No provider call, no error.
14. **A draft article must never reach the prompt.** `KbGrounding::forQuestion()` filters on
    `status = published` **and** `whereNotNull('published_at')` before `ArticleSearch::apply()` ever
    runs, so a draft cannot be ranked in. Asserted directly against
    `$fake->calls[0][1]` (the transcript the generator received).
15. **The model cites a slug that was never offered.** `KbGrounding::citations()` intersects with the
    offered set; the invention is dropped silently and the answer still renders.
16. **A `refused: true` answer with citations.** Citations are forced to `[]` when refused — a
    refusal has no sources.
17. **The token ceiling is reached mid-conversation.** Checked **before** the call, so the last
    stored turn is always complete. `state` becomes `ended` and the conversation row is updated, so
    a reload shows the same state.
18. **The provider reports zero tokens.** Some OpenAI-compatible responses omit `usage`;
    `OpenAiCompatibleAssistGenerator:84-85` already defaults them to `0`. The token ceiling then
    never trips and only `max_messages` bounds the conversation. **Documented limitation** — this is
    why both ceilings exist.
19. **Escalating a conversation with no messages** → `422 __('ai.chat_escalation_empty')`, no
    ticket. Guarded in `PortalChatController::escalate()`.
20. **Escalating twice.** The first call sets `state = escalated`; `existing()` only returns
    `active` conversations, so the second call finds none and 422s. The customer's next question
    opens a fresh conversation.
21. **Escalation creates a ticket, which fires the classification observer.** Intended, and it
    consumes one of the three per-request classification slots. In a test using
    `bindAssistGenerator()`, it also consumes one queued `respondWith()` response — **queue the
    classifier's JSON response, or the assertion on the chat response will read the wrong content.**
    This is the single most likely test-authoring mistake in the story.
22. **`ApiContractTest.php:322-343` fails on a misplaced route.** Any new `api/portal/*` route must
    live inside the `['portal', 'throttle:portal']` group. Adding a public chat route would fail the
    suite immediately.
23. **A staff token on a portal chat route.** `PortalAuth` hashes the bearer and looks it up in
    `portal_sessions`; a Sanctum token is not there, so it 401s with the generic body. Already
    covered in spirit by `PortalTokenIsolationTest.php`; this story adds the chat routes to it.
24. **A 429 body is the framework's, not ours.** `throttle:portal-chat` answers before the
    controller, so there is no `state` key in that response. The SPA maps the status itself
    (Decision 10); do not try to intercept the limiter.
25. **`config:cache` must keep working.** The new config keys are plain `env()` reads with literal
    defaults; the limiter reads `config()` **inside** the per-request closure. Nothing new is
    evaluated at container-boot time.
26. **RTL.** Every new portal component inherits `dir` from `PortalLayout`'s
    `<div className="portal-root" … dir={direction}>`. Do not hard-code `margin-left`/`padding-left`
    in `portal.css`; use the logical properties the file already uses.
27. **`decimal` vs `float`.** If `ai_confidence` is left with the default `decimal:2` cast, PostgreSQL
    returns a string and `TicketResource` emits `"0.90"`. The `'float'` cast is required for the SPA's
    percentage maths. This will not fail a naive test that compares loosely — assert the **type**.
28. **`updated_at` in a base-builder update.** `->toBase()->update()` does **not** set `updated_at`
    automatically, which is why it is passed explicitly. Omitting it entirely would also work; passing
    the prior value is explicit and survives a future refactor to an Eloquent update.

---

## Test Plan

Every test uses `bindAssistGenerator()` / `bindFailingAssistGenerator()` from `api/tests/Pest.php`.
**No live key, no `Http::fake()`, no network.** `api/tests/Pest.php` is **not modified**.

### A — `api/tests/Feature/Ai/TicketClassificationTest.php` (new)

1. **stores a confident suggestion without touching category or priority** — create a ticket via
   `POST /api/tickets` with `category=billing, priority=low`; the fake returns
   `{"category":"technical","priority":"urgent","confidence":0.92,"reason":"x"}`. Assert
   `ai_suggested_category === 'technical'`, `ai_suggested_priority === 'urgent'`,
   `ai_confidence === 0.92`, `needs_triage === false`, **and** `category === 'billing'`,
   `priority === Priority::Low`. **Done Criterion 1.**
2. **writes no `category_changed` event** — same setup; assert
   `TicketEvent::where('ticket_id', …)->whereIn('event', ['category_changed','priority_changed'])->count() === 0`.
   **Done Criterion 1's "audited" half, negative side.**
3. **an agent override is audited** — `PATCH /api/tickets/{id}` with `{category: 'technical'}`;
   assert a `category_changed` row exists with `user_id` = the agent and that `needs_triage` is now
   `false`. **Done Criterion 1's positive side.**
4. **low confidence stores no suggestion and flags triage** — fake returns
   `{"category":"billing","priority":"high","confidence":0.2}`. Assert both `ai_suggested_*` are
   `null`, `ai_confidence === 0.2`, `ai_classified_at` is **not** null, `needs_triage === true`.
   **Done Criterion 2.**
5. **an invalid enum value is treated as low confidence** — `{"category":"Refunds","priority":"urgent","confidence":0.99}`.
   Assert `needs_triage === true` and both suggestions `null`.
6. **unparseable output is treated as low confidence** — fake returns `I think this is billing.`
   Assert `ai_confidence === 0.0`, `needs_triage === true`.
7. **a provider failure leaves the ticket untouched** — `bindFailingAssistGenerator()`. Assert the
   `POST /api/tickets` is still **201**, `ai_classified_at === null`, `needs_triage === false`, and
   every other column matches the request. **Done Criterion 6, first half.**
8. **classification is skipped when `ai.enabled` is false** — `config(['ai.enabled' => false])`;
   assert the fake's `timesCalled === 0` and `ai_classified_at === null`.
9. **classification is skipped when `ai.classify.enabled` is false** — same, on the new key.
10. **the portal creation path also classifies** — `POST /api/portal/requests` with a portal token;
    assert `ai_suggested_category` is set. Proves `DB::afterCommit` fires inside a transaction.
11. **the per-request cap holds** — set `config(['ai.classify.max_per_request' => 1])`, create two
    tickets in one test; assert the fake's `timesCalled === 1`. (Note: `TestCase::setUp()` resets the
    counter between tests, so this must happen inside one test.)
12. **classification does not move `updated_at`** — capture `updated_at` after create, assert it is
    unchanged after classification.
13. **the model id is clamped to 64 characters** — a fake returning a 200-character model; assert
    `strlen($ticket->ai_classification_model) === 64`.
14. **`ai_confidence` is a float in the resource** — `GET /api/tickets/{id}`; assert
    `is_float($response->json('data.ai_classification.confidence'))`.

### B — `api/tests/Feature/Ai/TicketClassificationDismissTest.php` (new)

15. **`DELETE /api/tickets/{id}/ai-classification` clears the suggestion and the flag**, returns
    204, and leaves `ai_classified_at` and `ai_confidence` intact.
16. **an agent who cannot update the ticket gets 403** — an Agent and someone else's ticket, mirroring
    `AiAssistAccessTest.php`'s shape.
17. **the route is not throttled by `ai-assist`** — 10 consecutive deletes all answer 204.

### C — `api/tests/Unit/JsonAnswerTest.php` (new)

18. plain object; 19. fenced ```` ```json ````; 20. prose prefix and suffix; 21. garbage → `null`;
22. a JSON **array** (not object) → `null`; 23. empty string → `null`.

### D — `api/tests/Unit/ClassificationPromptTest.php` (new)

24. the system prompt names all five categories and all four priorities;
25. the description is clamped to `ai.classify.max_chars`;
26. an empty description renders `(no description provided)`;
27. the prompt carries the subject, the channel value and the customer tier.

### E — `api/tests/Feature/Portal/PortalChatTest.php` (new)

28. **an unauthenticated call is 401** on all three routes.
29. **`GET /api/portal/chat` returns the empty shell** — `enabled: true`, `conversation: null`,
    `messages: []`.
30. **a grounded question returns an answer with a citation** — publish a `KbArticle` whose title
    matches the question; the fake returns
    `{"answer":"Use the reset link.","citations":["reset-your-password"],"refused":false}`. Assert
    `state === 'ok'`, `message.body`, and `message.citations[0].slug === 'reset-your-password'`.
    **Done Criterion 3.**
31. **the prompt contains the published article and its slug** — assert on `$fake->calls[0][1]`.
32. **a draft article is never in the prompt** — create one published and one draft article that both
    match; assert the draft's title is **absent** from `$fake->calls[0][1]`.
33. **a hallucinated citation slug is dropped** — the fake cites `"not-a-real-slug"`; assert
    `message.citations === []` while `state === 'ok'`.
34. **`refused: true` returns `state: refused` with no citations.**
35. **zero matching articles short-circuits the provider** — ask about something no article covers;
    assert `state === 'refused'`, the canned body, and `$fake->timesCalled === 0`.
36. **multi-turn history reaches the prompt** — ask twice on one fake instance (`respondWith()` twice,
    per `Pest.php:52-63`); assert the second call's transcript contains the first question **and**
    the first answer.
37. **`GET /api/portal/chat` replays a stored conversation** with both messages in order.

### F — `api/tests/Feature/Portal/PortalChatGuardrailsTest.php` (new)

38. **the message ceiling ends the conversation** — `config(['ai.chat.max_messages' => 2])`; the
    second question returns `state === 'ended'` with `message: null` and the conversation's `state`
    persisted as `ended`. **Done Criterion 5.**
39. **the token ceiling ends the conversation** — `config(['ai.chat.max_tokens_per_conversation' => 5])`;
    the fake reports 10+5 tokens, so the second question is `ended`. **Done Criterion 5.**
40. **the rate limiter answers 429** — `config(['ai.chat.rate_per_minute' => 2])`; the third POST in
    a minute is 429 and carries `Retry-After`. **Done Criterion 5.**
41. **`throttle:portal-chat` does not throttle the other portal routes** — after tripping it,
    `GET /api/portal/requests` is still 200.
42. **the question is capped at `ai.chat.max_question_chars`** — a 1001-character body is 422.
43. **a provider failure returns `state: unavailable`, HTTP 200** — `bindFailingAssistGenerator()`;
    assert the customer's question **is** stored, no assistant message is stored, and the
    conversation's token counters are unchanged. **Done Criterion 6, second half.**
44. **unparseable output returns `state: unavailable`** and stores no assistant message.
45. **`config(['ai.chat.enabled' => false])` returns `state: unavailable` and `enabled: false`** from
    `GET /api/portal/chat`, with `$fake->timesCalled === 0`.
46. **`messages_remaining` and `tokens_remaining` are computed server-side** and shrink after a turn.

### G — `api/tests/Feature/Portal/PortalChatEscalationTest.php` (new)

47. **"talk to a person" creates a ticket carrying the transcript** — two turns, then
    `POST /api/portal/chat/escalate`. Assert **201**, a `Ticket` for the right `customer_id` with
    `channel === 'chat'`, `status === 'open'`, `created_by === null`, and a `description` containing
    **both** customer questions and **both** assistant answers. **Done Criterion 4.**
48. **the transcript is also the first `TicketMessage`**, `author_type === 'customer'`,
    `visibility === public` — so it renders in the portal thread and in the agent thread.
49. **the conversation becomes `escalated` and carries `escalated_ticket_id`.**
50. **the new ticket appears in `GET /api/portal/requests`** for that customer.
51. **escalating an empty conversation is 422** and creates no ticket.
52. **escalating twice is 422** on the second call.
53. **the escalated ticket is itself classified** — with the classifier's JSON queued **after** the
    two chat responses on the same fake (Edge Case 21), assert `ai_suggested_category` is set.
54. **the transcript is capped at 5000 characters** — 10 long turns; assert
    `strlen($ticket->description) <= 5000`.

### H — `api/tests/Feature/Portal/PortalChatIsolationTest.php` (new)

55. **another customer's conversation is invisible** — two portal sessions, two conversations;
    assert each `GET /api/portal/chat` returns only its own messages.
56. **a staff Sanctum token is 401 on every chat route** — extends the spirit of
    `PortalTokenIsolationTest.php`.
57. **a revoked session is 401** on all three routes.
58. **the escalated ticket is not visible to another customer** — `GET /api/portal/requests/{id}` as
    the other customer is **404**, matching `ownedTicket()`'s single-404 path.

### I — `api/tests/Feature/ApiContractTest.php` (extend, do not restructure)

59. **`GET /api/portal/chat` shape lock** — exactly `['enabled', 'conversation', 'messages']`,
    asserted with `toEqualCanonicalizing`, copying the Story 19 lock at `:345-358`.
60. **`POST /api/portal/chat/messages` shape lock** — exactly `['state', 'conversation', 'message']`.
61. The existing portal-route gate test at `:322-343` **must pass unchanged** — do not touch it.
    Assert in the run log that `$checked` grew by 3.

### J — `api/tests/Feature/Seeding/…` (extend the existing seeding test file)

62. **`migrate:fresh --seed` performs zero classifications** — bind the fake, run the seeder, assert
    `timesCalled === 0` and that no seeded ticket has a non-null `ai_classified_at`. **Edge Case 1.**

### K — `api/tests/Feature/Ai/AiSmokeCommandTest.php` (extend)

63. `ai:smoke --kind=classify` prints the parsed keys and **writes nothing** — assert the ticket's
    `ai_classified_at` is still null afterwards.
64. `ai:smoke --kind=chat --question="…"` prints the article count and the parsed answer.
65. `ai:smoke --kind=chat` **without** `--question` fails with a clear message and a non-zero exit.

### L — Frontend

66. **`web/src/features/portal/pages/PortalChatPage.test.tsx`** (new) — using
    `web/src/features/portal/testUtils.tsx`: renders the loading skeleton; renders a returned
    assistant message and its citation link pointing at `/portal/faq/{slug}`; renders the
    `unavailable` notice on `state: 'unavailable'`; disables the composer on `state: 'ended'`;
    renders the rate-limited notice when the mutation rejects with a 429.
67. **`web/src/features/tickets/components/thread/ClassificationCard.test.tsx`** (new) — renders
    nothing extra when `ai_classification` is `null`; renders the suggestion row and a percentage
    when a suggestion differs from the live values; renders **nothing** when the suggestion matches;
    renders the "needs triage" pill with a Dismiss button when `needs_triage` is true; clicking
    **Apply** fires the attribute mutation with both fields.
68. **`web/src/i18n/catalogueParity.test.ts` must pass unchanged** — every new key exists in both
    `en` and `ar`.

---

## Migration / Rollback

Three migrations, all additive:

1. `2026_09_09_100000_add_ai_classification_to_tickets_table.php` — six nullable/defaulted columns
   plus one index on an existing table. **Safe on a populated `tickets` table**: no column is `NOT
   NULL` without a default, so no backfill is needed and no lock beyond the `ALTER` is taken.
   Existing rows read as "never classified" (`ai_classified_at IS NULL`), which is the correct
   meaning.
2. `…_100100_create_portal_chat_conversations_table.php` and `…_100200_create_portal_chat_messages_table.php`
   — new tables. **Order matters**: conversations before messages, because of the FK.

**Half-applied states.** If migration 1 applies and 2/3 do not, classification works and the chat
routes 500 on a missing table — so **deploy all three or none**. `php artisan migrate:rollback
--step=3` reverses cleanly: `down()` on migration 1 drops the index **before** the columns (required
on PostgreSQL), and the two `dropIfExists` calls are order-independent because the FK is dropped
with the table.

**Feature rollback without a migration rollback:** set `AI_CLASSIFY_ENABLED=false` and
`AI_CHAT_ENABLED=false`. The observer returns immediately, `GET /api/portal/chat` reports
`enabled: false`, and the SPA renders the unavailable state. The columns and tables stay, inert.
`AI_ASSIST_ENABLED=false` (or removing the provider key) disables **all three** AI features at once,
including the WIS-18 cards — which is the bigger hammer.

---

## Verification Steps

1. **Backend migrates:** in `api/` — `php artisan migrate` then `php artisan migrate:rollback --step=3`
   then `php artisan migrate` again. All six commands exit 0.
2. **Backend tests:** in `api/` — `php artisan test`. Expect **552 + ~55 = ~607 pass** and zero
   failures. Then the focused runs: `php artisan test --filter=Classification`,
   `--filter=PortalChat`, `--filter=Ai`.
3. **Config caches:** in `api/` — `php artisan config:cache` then `php artisan config:clear`, both
   exit 0. This is the check the new limiter closure and the two config blocks can break.
4. **Formatter:** in `api/` — `./vendor/bin/pint --test` on the paths this story touched only.
   (Repo-wide `pint --test` is dirty on ~30 pre-existing files; do not "fix" them.)
5. **Seeder makes no AI calls:** in `api/` with the live Groq key present —
   `php artisan migrate:fresh --seed`, then
   `php artisan tinker --execute="echo App\Models\Ticket::whereNotNull('ai_classified_at')->count();"`
   → **0**. Edge Case 1.
6. **Live classification, end to end** (needs the key already in `api/.env`):
   `php artisan ai:smoke --kind=classify` prints a parsed `{category, priority, confidence}`. Then
   create a ticket through the running SPA and confirm the suggestion chip appears in the ticket
   thread's Classification card within a second of the create.
7. **Live grounded chat:**
   `php artisan ai:smoke --kind=chat --question="How do I reset my password?"` prints the matched
   article slugs and a parsed `{answer, citations, refused}`.
8. **Portal walkthrough:** `npm run dev` in `web/` and `php artisan serve` in `api/`. Sign in at
   `/portal`, open `/portal/chat`, ask a KB-covered question, confirm the citation link opens
   `/portal/faq/{slug}`, then click "Talk to a person" and confirm you land on the new request with
   the transcript as its first message.
9. **Unavailable state:** set `AI_CHAT_ENABLED=false`, `php artisan config:clear`, reload
   `/portal/chat` — the calm unavailable notice renders and the composer is disabled. No console
   error, no 5xx in the network tab.
10. **Frontend runs:** in `web/` — `npm run lint` (which runs `oxlint` **and** `i18n:check`),
    `npx tsc -b --force`, `npm run build`, `npm test`. All exit 0. Expect **570 + ~10 = ~580** web
    tests passing.
11. **RTL + dark:** toggle the portal's language pill to Arabic and the theme toggle to dark on
    `/portal/chat`. Bubbles, the composer and the citation list mirror correctly; no clipped text.
12. **Regression:** confirm `git diff --name-only` touches **no** file under
    `web/src/features/ai-assist/`, does **not** modify `api/tests/Pest.php`, does **not** modify
    `api/app/Services/Ai/AssistGenerator.php`, and adds **no** entry to `api/composer.json` or
    `web/package.json`.
13. **Secret grep:** `git diff | grep -iE "gsk_|AIza|sk-"` returns nothing.

---

## Done Criteria

Copied verbatim from the Jira issue's "Done criteria" block.

- [ ] A new ticket gets a category/priority proposal; agent override is respected and audited.
- [ ] Low confidence => no field change, ticket flagged for triage.
- [ ] Portal chatbot answers a KB-covered question with a citation.
- [ ] "Talk to a person" creates a ticket with the full transcript attached.
- [ ] Rate limit + token ceiling enforced and tested.
- [ ] Provider failure degrades gracefully — classification is skipped, chatbot shows an unavailable state.

**All six are code-verifiable with the fake generator** — unlike WIS-26 and WIS-27, none needs an
external account or a live key. The mapping:

| Criterion | Discharged by |
|---|---|
| 1 | Test Plan A1, A2, A3 (+ Verification 6 for the live view) |
| 2 | Test Plan A4, A5, A6 |
| 3 | Test Plan E30, E31, E32 (+ L66 for the citation link, Verification 7-8 live) |
| 4 | Test Plan G47, G48, G49, G50 |
| 5 | Test Plan F38, F39, F40 |
| 6 | Test Plan A7 (classification) and F43, F45 (chatbot) |

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 25.**
