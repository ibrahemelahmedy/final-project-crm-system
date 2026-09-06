# Story 19 — AI Assist: Ticket Summary & Suggested Reply (Story: WIS-18)

---

## Prerequisites

- **Story 05 completed** ([`../conversation-thread/05-story-conversation-thread.md`](../conversation-thread/05-story-conversation-thread.md)) — this story fills the slot Story 05 reserved and **must not otherwise change that screen**. Both extension points already exist in code and are used unchanged: `ReplyComposer`'s `onInsertAtCaret` / `.thread-assist-slot` (`web/src/features/tickets/components/thread/ReplyComposer.tsx:19`, `:189`) and `TicketMetaPanel`'s `extraSlot` (`.../TicketMetaPanel.tsx:32`, `:169`).
- **Story 04 completed** — `tickets`, `ticket_messages`, `TicketPolicy@view`. This story reads them and owns no ticket state.
- **Story 10 completed** — `TicketMessage::scopePublicOnly()` (`api/app/Models/TicketMessage.php:64–67`) is the filter the suggested-reply prompt runs through. Story 13's `TicketCsatPanel` is the precedent for a feature module mounted through `extraSlot` without restructuring the panel.
- **Story 15 completed** ([`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md)) — `useT`, `formatRelative`, the `conversation` namespace slot, and `web/src/i18n/catalogueParity.test.ts`.
- **Coordinate with Story 16 (WIS-17) — it is IN FLIGHT, uncommitted, in the working tree.** ([`../i18n-retrofit/16-story-i18n-retrofit.md`](../i18n-retrofit/16-story-i18n-retrofit.md)) That story's namespace table (line 116) assigns `web/src/features/tickets/components/thread/` to the **`conversation`** namespace, and it has already **populated** `web/src/i18n/locales/{en,ar}/conversation.json` with eleven top-level groups (`section`, `activity`, `agent`, `customer`, `composerBadge`, `note`, `messages`, `composer`, `attribute`, `states`, `meta`, `close`). There is no `assist` group, so this story's keys land beside them with **no collision** — but verify that before writing, because the catalogue is moving. This story does **not** add `src/features/tickets` to `web/scripts/i18n-allowlist.json`'s `roots` (still six roots, unchanged) — that is WIS-17's deliverable.
- **Line numbers in two files will drift.** As of planning, 10 of the 20 files in `components/thread/` have been migrated to `useT`, but **`ReplyComposer.tsx` and `TicketMetaPanel.tsx` have not** (`grep -c "useT(" …` returns 0 for both), so every line number this plan cites in them is accurate against the current working tree. WIS-17 will edit both — its catalogue already carries the `composer.*`, `meta.*`, `close.*` and `section.ticketDetails` keys they need. **If WIS-17 lands first, re-locate the anchors by symbol** (`.thread-assist-slot`, `<aside className="meta-panel">`, the `ReplyComposerProps` type) rather than by the line numbers below.
- **New composer dependency:** `anthropic-ai/sdk` (see Task 1). No frontend dependency is added.

---

## Story Goal

Fill the reserved AI slot on the Conversation Thread with the two artefacts that plug into the composer, and nothing else:

1. **A ticket-summary card** at the top of the metadata panel — a 2–4 line AI summary of the ticket, badged `AI`, with a regenerate action and a "Summarized N minutes ago" staleness line.
2. **A suggested-reply card** immediately above the reply composer — an AI-drafted customer reply with **Use this reply** (inserts into the composer, editable), **Dismiss**, and regenerate.
3. **A backend AI integration** that produces both from the ticket's message thread, behind a swappable seam, rate-limited, budgeted, and off by default when unconfigured.

**Never**: auto-send. `POST /api/tickets/{ticket}/messages` is untouched; AI text reaches the customer only after an agent presses **Send** on their own reply. Nothing this story writes ever becomes a `ticket_messages` row.

**Not in scope** (each is a different surface, per the intake): automatic categorization, suggested solutions from the Knowledge Base, an AI chatbot, and every Customer Portal-side AI feature. No `/api/portal/*` route is added, read, or modified.

---

## Context — Read These Files First

1. `docs/design/references/17.WisalAIAssistPanel/WisalAIAssistPanel-LightLTR.dc.html` — the five artboards, in file order: **SUGGESTION READY**, **GENERATING**, **SUGGESTION USED**, **SUGGESTION DISMISSED**, **GENERATION FAILED**. Read the `<!-- Composer -->` and `<!-- Metadata panel -->` blocks in each. Then diff against `WisalAIAssistPanel-DarkLTR.dc.html` for the dark token values and `WisalAIAssistPanel-LightRTL.dc.html` for the Arabic copy. Every colour in Task 9's token table came from these four files.
2. `docs/design/references/3.Conversation Thread/` — the shell that must not change. The AI artboards reuse it verbatim.
3. `web/src/features/tickets/components/thread/ReplyComposer.tsx` — **lines 10–28** (the props type: `onInsertAtCaret`, `toolbarSlot`, `onSendNote`), **lines 63–81** (`insertAtCaret` and the `useEffect` that hands it up), and **lines 182–190**, where `<div className="thread-assist-slot" />` is the empty node Story 05 left for exactly this card. Read its comment before editing.
4. `web/src/features/tickets/components/thread/TicketMetaPanel.tsx` — **lines 23–34** (props, including `extraSlot` and its Story 13 docblock) and **lines 109–170** (render order: `TICKET DETAILS` section → `SlaCard` → `AssignedAgentCard` → `CustomerInfoCard` → `ClassificationCard` → `TicketTasksPanel` → `{extraSlot}` → `ActivityList`). The design puts the summary card **above** `TICKET DETAILS`, which no existing slot reaches — Task 11 adds one.
5. `web/src/features/tickets/pages/TicketDetailPage.tsx` — **lines 45–55** (`insertAtCaretRef` + `captureInsert`, already wired for Stories 09/10) and **lines 105–155**, where `ReplyComposer` and `TicketMetaPanel` are mounted. This is the only page file this story edits.
6. `web/src/features/csat/` (all of it, ~6 small files) — the shape to copy for a new feature module: `index.ts` as the sole public surface, `api/`, `hooks/`, `model/`, `components/`, one CSS import. `components/TicketCsatPanel.tsx:45–62` is the four-async-states pattern inside a metadata-panel card.
7. `api/app/Services/PortalAccess.php:18–60` — the precedent for "the whole state machine in one `final class` so no controller holds policy", and `api/app/Services/PortalCodeNotifier.php` + `MailPortalCodeNotifier.php` for the interface-plus-implementation seam.
8. `api/app/Providers/AppServiceProvider.php:26–46` — where the three existing seams are bound. Task 4 adds a fourth in the same block.
9. `api/bootstrap/app.php:22–58` — the four named rate limiters. Task 5 adds `ai-assist` here.
10. `api/routes/api.php:52–64` — the `/tickets/{ticket}/*` block inside `['auth:sanctum', 'active']`. Task 6's routes go directly after line 64, before the SLA block.
11. `api/database/migrations/2026_08_28_160000_create_csat_surveys_table.php` — the migration convention, including its `$driver === 'sqlite'` branch. Task 2's migration needs no such branch (no CHECK constraint), but follow its docblock style.
12. `api/tests/Feature/Csat/` and `api/tests/Feature/Portal/` — the Pest feature-test layout Task 12's tests mirror.
13. Grep for `scopePublicOnly` across `api/` — every existing caller. Task 3's reply prompt becomes one more.

---

## Product rules (from story)

| | Current behaviour | New behaviour |
|---|---|---|
| Metadata panel | Opens with `TICKET DETAILS`. | Opens with the **AI summary card**, then `TICKET DETAILS` unchanged. |
| Composer | `.thread-assist-slot` renders nothing (`ReplyComposer.tsx:184–189`). | Renders the suggested-reply card in one of six states. |
| Sending a reply | Agent types, presses Send. | Unchanged. AI text is only ever pre-filled composer content the agent may edit or delete. |
| AI unavailable | n/a | Neither card renders. The composer behaves exactly as it does today. |

---

## Decisions this story makes explicitly

The intake defers model choice, prompt design, and cost/rate-limit handling to planning. All six are settled here; Decisions 2 and 3 are the ones later stories will cite.

**Decision 1 — the provider is the Anthropic Messages API via the official PHP SDK (`anthropic-ai/sdk`), model `claude-opus-5`, adaptive thinking at `effort: 'low'`.** No provider-neutral abstraction layer and no OpenAI-compatible shim: the seam is `App\Services\Ai\AssistGenerator` (Task 3), which is where a second provider would go if one is ever needed. `effort: 'low'` because both artefacts are short, bounded rewrites of text already present in the prompt — the cheapest setting that holds quality on this workload, and tunable from `config/ai.php` without a code change.

**Decision 2 — the suggested-reply prompt sees ONLY `publicOnly()` messages; the summary sees all of them.** The summary is an agent-only surface and the design's own copy summarises an internal note (*"An internal note flags 3 failed attempts…"*), so it gets the full thread. The suggested reply is a draft of text that will be sent to a customer, so it is built from the customer-visible transcript alone — enforced **in the query** (`AssistTranscript::forReply()`, Task 3), the same rule Stories 05/10/17 already apply. An internal note therefore cannot be paraphrased into a customer reply even if the model is asked to.

**Decision 3 — the summary auto-generates on first view; the suggested reply is agent-initiated.** This is what the artboards show: the **SUGGESTION DISMISSED** artboard renders a populated summary card *and* an idle `Suggest a reply` button, so the two artefacts have different triggers. It also bounds cost — the second artefact is only produced when an agent asks for it.

**Decision 4 — generation is synchronous request/response, not queued.** A queued job would need a second polling endpoint and a durable job table on a serverless deployment; the timeout budget (`config('ai.timeout')`, default 30s) is inside what the SPA can wait on with a visible skeleton, which is precisely what the **GENERATING** artboard depicts. If a call exceeds the timeout the request returns the failed shape and the composer is unaffected.

**Decision 5 — artefacts are persisted and reused, and staleness is a timestamp only.** Re-opening a ticket must not re-bill a generation. One `ai_assist_artifacts` row per `(ticket_id, kind)`, replaced on regenerate. The design shows *"Summarized 2 min ago"* and **no** stale badge, so the row records `source_message_id` for diagnostics and tests but the UI renders only relative time. Do not add a "stale" pill the design does not have.

**Decision 6 — the "AI" chip stays Latin in Arabic.** This confirms the intake's open question. The RTL artboard renders the chip as `AI` (the same `#7C3AED` pill as LTR) while every neighbouring label is translated (`ملخص التذكرة`, `استخدام هذا الرد`, `تجاهل`). The chip is a two-character badge at `font-size:10px` inside a `padding:2px 6px` pill; `ذكاء اصطناعي` triples its width and breaks the card header row. It goes in `web/scripts/i18n-allowlist.json` `literals` with that reason.

---

## Backend Tasks

### 1 — Add the SDK and the config file

Run in `api/`:

```bash
composer require "anthropic-ai/sdk"
```

**Create file: `api/config/ai.php`**

```php
<?php

return [
    /*
     * Story 19 (WIS-18). AI Assist is OFF unless a key is present. Every
     * consumer checks `enabled` — never `key` — so a deployment can disable
     * the feature without discarding its credential.
     */
    'enabled' => env('AI_ASSIST_ENABLED', true) && filled(env('ANTHROPIC_API_KEY')),

    'key' => env('ANTHROPIC_API_KEY'),

    // Do NOT append a date suffix; this id is complete as written.
    'model' => env('AI_ASSIST_MODEL', 'claude-opus-5'),

    // Both artefacts are short. `low` is the cheapest setting that holds
    // quality on this workload; raise it here, not in the service.
    'effort' => env('AI_ASSIST_EFFORT', 'low'),

    // Adaptive thinking is on by default on claude-opus-5 and its tokens
    // count against this ceiling, so it is not sized to the visible output.
    'max_tokens' => (int) env('AI_ASSIST_MAX_TOKENS', 4096),

    // Seconds. Decision 4 — the synchronous budget the SPA waits on.
    'timeout' => (int) env('AI_ASSIST_TIMEOUT', 30),

    // The newest N messages fed to the model. Bounds cost on a long thread.
    'transcript_messages' => (int) env('AI_ASSIST_TRANSCRIPT_MESSAGES', 40),

    // Per-message character clamp inside the transcript.
    'transcript_chars' => (int) env('AI_ASSIST_TRANSCRIPT_CHARS', 2000),
];
```

**File: `api/.env.example`** — append after the mail block:

```
# Story 19 (WIS-18) — AI Assist. Unset key = feature off, no UI, no errors.
ANTHROPIC_API_KEY=
AI_ASSIST_ENABLED=true
```

### 2 — The `ai_assist_artifacts` table

**Create file: `api/database/migrations/2026_09_03_100000_create_ai_assist_artifacts_table.php`**

One row per `(ticket_id, kind)`; a regenerate **replaces** it. No CHECK constraint is needed, so no SQLite branch (unlike `2026_08_28_160000_create_csat_surveys_table.php:33–78`).

```php
Schema::create('ai_assist_artifacts', function (Blueprint $table) {
    $table->bigIncrements('id');
    $table->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
    $table->string('kind', 24);                       // AssistKind: summary | suggested_reply
    $table->text('content');
    $table->string('model', 64);
    $table->string('locale', 8);                      // the locale it was GENERATED in
    $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
    $table->unsignedBigInteger('source_message_id')->nullable(); // newest message in the prompt
    $table->unsignedInteger('input_tokens')->default(0);
    $table->unsignedInteger('output_tokens')->default(0);
    $table->timestamp('dismissed_at')->nullable();    // suggested_reply only
    $table->timestamps();

    $table->unique(['ticket_id', 'kind']);
});
```

`down()`: `Schema::dropIfExists('ai_assist_artifacts');`

**Create file: `api/app/Enums/AssistKind.php`** — a backed string enum with cases `Summary = 'summary'` and `SuggestedReply = 'suggested_reply'`, in the style of `api/app/Enums/CsatSurveyState.php`.

**Create file: `api/app/Models/AiAssistArtifact.php`** — `$fillable` for every column above; `casts()` maps `kind` to `AssistKind` and `dismissed_at` to `datetime`; one relation, `ticket(): BelongsTo`.

**Create file: `api/database/factories/AiAssistArtifactFactory.php`** — mirrors `api/database/factories/PortalAccessCodeFactory.php`. Add `summary()` and `suggestedReply()` states.

### 3 — The generation seam and its two implementations

**Create file: `api/app/Services/Ai/AssistResult.php`** — a `final readonly class` holding `string $content`, `string $model`, `int $inputTokens`, `int $outputTokens`.

**Create file: `api/app/Services/Ai/AssistGenerator.php`**

```php
interface AssistGenerator
{
    /**
     * @throws \App\Exceptions\AssistUnavailableException on any provider
     *         failure — the caller turns that into the `failed` shape and
     *         NEVER lets it reach the composer.
     */
    public function generate(string $system, string $transcript): AssistResult;
}
```

**Create file: `api/app/Exceptions/AssistUnavailableException.php`** — extends `\RuntimeException`, mirroring `api/app/Exceptions/PortalCodeUnusableException.php`.

**Create file: `api/app/Services/Ai/AnthropicAssistGenerator.php`**

```php
use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\RateLimitException;

final class AnthropicAssistGenerator implements AssistGenerator
{
    public function __construct(private Client $client) {}

    public function generate(string $system, string $transcript): AssistResult
    {
        try {
            $message = $this->client->messages->create(
                model: config('ai.model'),
                maxTokens: (int) config('ai.max_tokens'),
                system: [
                    // The system prompt is stable per kind and goes FIRST so
                    // the cache prefix survives across tickets.
                    ['type' => 'text', 'text' => $system, 'cacheControl' => ['type' => 'ephemeral']],
                ],
                thinking: ['type' => 'adaptive'],
                outputConfig: ['effort' => config('ai.effort')],
                messages: [['role' => 'user', 'content' => $transcript]],
            );
        } catch (RateLimitException|APIStatusException|APIConnectionException $e) {
            throw new AssistUnavailableException($e->getMessage(), previous: $e);
        }

        // A safety classifier can decline with HTTP 200. Check BEFORE reading
        // content, or an empty draft lands in the composer.
        if ($message->stopReason === 'refusal') {
            throw new AssistUnavailableException('refused');
        }

        $text = '';
        foreach ($message->content as $block) {
            // Adaptive thinking puts a ThinkingBlock first — never index [0].
            if ($block->type === 'text') {
                $text .= $block->text;
            }
        }

        if (trim($text) === '') {
            throw new AssistUnavailableException('empty completion');
        }

        return new AssistResult(
            trim($text),
            $message->model ?? (string) config('ai.model'),
            $message->usage->inputTokens ?? 0,
            $message->usage->outputTokens ?? 0,
        );
    }
}
```

Catch the three exception classes **in that order**, most specific first — `RateLimitException` before `APIStatusException`, per the SDK's hierarchy. Do not collapse them into one `catch (\Throwable)`.

**Create file: `api/app/Services/Ai/UnavailableAssistGenerator.php`** — `generate()` throws `AssistUnavailableException('AI assist is not configured.')` unconditionally. Bound when `config('ai.enabled')` is false; it is also what a test binds to exercise the failed state.

**Create file: `api/app/Services/Ai/AssistTranscript.php`** — the prompt builder. **No HTTP, no model calls** — unit-testable in isolation.

```php
final class AssistTranscript
{
    /** All messages, internal notes included (Decision 2). */
    public function forSummary(Ticket $ticket, string $locale): array;   // [$system, $transcript]

    /** publicOnly() IN THE QUERY (Decision 2). */
    public function forReply(Ticket $ticket, string $locale): array;     // [$system, $transcript]

    /** The newest message id present in the built transcript, or null. */
    public function lastMessageId(): ?int;
}
```

Both builders:

- take the newest `config('ai.transcript_messages')` rows via `$ticket->messages()->latest('id')->limit(...)` and re-sort ascending in PHP, so a long thread is bounded from the recent end;
- clamp each body with `Str::limit($body, config('ai.transcript_chars'))`;
- render each line as `[<author role>] <name> · <channel> · <ISO 8601>` followed by the body, with internal notes marked `[INTERNAL NOTE]` in the summary transcript only;
- prepend the ticket subject, status label and priority label;
- pass `$locale` into the system prompt as an explicit instruction — **"Write the summary in Arabic."** / **"Write the reply in Arabic."** for `ar`, English otherwise. The locale comes from `app()->getLocale()`, which `SetLocale` (`api/bootstrap/app.php:65`) has already resolved from the SPA's `Accept-Language`, so an Arabic UI gets an Arabic artefact with no new request parameter.

The two system prompts, verbatim, as `private const` on this class:

- **Summary** — "You are summarising a customer-support ticket for the support agent handling it. Write 2 to 4 short lines of plain prose. State what the customer needed, what has been done, and where the ticket stands now. The transcript may contain internal agent notes; you may use them, since only agents read this summary. Do not address the customer. Do not use markdown, headings, or bullet points. Do not invent facts that are not in the transcript."
- **Reply** — "You are drafting a reply that a human support agent will review before sending to the customer. Write one short paragraph in the same tone as the agent's previous replies in this thread. Address the customer directly. Do not promise anything the transcript does not support, do not invent order numbers, dates, refunds, or policies, and do not include a subject line, a signature, or placeholders such as [name]. Do not use markdown. If the transcript does not contain enough information to reply usefully, say briefly that you need more detail."

**Create file: `api/app/Services/Ai/TicketAssist.php`** — the state machine, and the only place that writes `ai_assist_artifacts`. Modelled on `PortalAccess`.

```php
final class TicketAssist
{
    public function __construct(
        private AssistGenerator $generator,
        private AssistTranscript $transcript,
    ) {}

    /** The cached row, or null. Never generates. */
    public function existing(Ticket $ticket, AssistKind $kind): ?AiAssistArtifact;

    /** Generate + upsert, replacing any prior row for this (ticket, kind). */
    public function generate(Ticket $ticket, AssistKind $kind, User $actor): AiAssistArtifact;

    /** Sets dismissed_at on the suggested reply. Idempotent. */
    public function dismiss(Ticket $ticket): void;
}
```

`generate()` writes through `AiAssistArtifact::updateOrCreate(['ticket_id' => …, 'kind' => …], [...])` so the unique index is the concurrency guard, and clears `dismissed_at` on a regenerate. It lets `AssistUnavailableException` propagate — the controller owns the HTTP mapping.

### 4 — Bind the seam

**File: `api/app/Providers/AppServiceProvider.php`**, inside `register()` after line 45:

```php
// Story 19 (WIS-18): the AI provider seam. Bound to the unavailable
// implementation when no key is configured, so an unconfigured deployment
// degrades to "no cards" instead of a 500 on every ticket open.
$this->app->singleton(Client::class, fn () => new Client(apiKey: (string) config('ai.key')));

$this->app->bind(AssistGenerator::class, fn ($app) => config('ai.enabled')
    ? $app->make(AnthropicAssistGenerator::class)
    : $app->make(UnavailableAssistGenerator::class));
```

Resolve through a closure, not a conditional at register time — the same reason as the `ArticleSearch` binding above it (lines 28–41): nothing may read config or open a connection while the container boots, or `artisan config:cache` breaks.

### 5 — The rate limiter

**File: `api/bootstrap/app.php`**, in the `then:` closure after line 57:

```php
// Story 19 (WIS-18): AI generation is the only paid-per-call endpoint in
// the app. Keyed on the USER, not the IP — a shared office NAT must not
// let one agent's regenerate loop lock out the floor. Separate from every
// other limiter, so exhausting it never touches the rest of the API.
RateLimiter::for('ai-assist', fn (Request $request) => [
    Limit::perMinute(6)->by('ai-user:'.($request->user()?->id ?? $request->ip())),
    Limit::perDay(200)->by('ai-user:'.($request->user()?->id ?? $request->ip())),
]);
```

### 6 — Routes

**File: `api/routes/api.php`** — add `use App\Http\Controllers\TicketAssistController;` in alphabetical position (after `TicketController`), and insert directly after line 64:

```php
// ---- AI Assist (Story 19 / WIS-18) --------------------------------
//
// TicketPolicy@view is the boundary on all four, exactly as
// /tickets/{ticket}/csat uses it. The GET is unthrottled beyond the
// global API limits because it only reads cached rows; the two
// generating routes carry `throttle:ai-assist`, the ONLY paid-per-call
// limiter in the app.
Route::get('/tickets/{ticket}/ai-assist', [TicketAssistController::class, 'show']);
Route::middleware('throttle:ai-assist')->group(function () {
    Route::post('/tickets/{ticket}/ai-assist/summary', [TicketAssistController::class, 'summary']);
    Route::post('/tickets/{ticket}/ai-assist/reply', [TicketAssistController::class, 'reply']);
});
Route::delete('/tickets/{ticket}/ai-assist/reply', [TicketAssistController::class, 'dismiss']);
```

`dismiss` sits outside the throttle group deliberately — dismissing costs nothing, and a 429 on Dismiss would strand the card on screen.

### 7 — Controller and resource

**Create file: `api/app/Http/Resources/AiAssistArtifactResource.php`** — a **frozen key set**:

```php
return [
    'content'    => $this->content,
    'locale'     => $this->locale,
    'model'      => $this->model,
    'created_at' => $this->created_at?->toIso8601String(),
    'updated_at' => $this->updated_at?->toIso8601String(),
    'dismissed'  => $this->dismissed_at !== null,
];
```

Token counts are **not** exposed — they are cost telemetry, not agent-facing data.

**Create file: `api/app/Http/Controllers/TicketAssistController.php`**

```php
final class TicketAssistController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private TicketAssist $assist) {}

    /** Cached artefacts only. Never generates, never bills. */
    public function show(Ticket $ticket): JsonResponse
    {
        $this->authorize('view', $ticket);

        return response()->json([
            'enabled'    => (bool) config('ai.enabled'),
            'summary'    => $this->resource($ticket, AssistKind::Summary),
            'suggestion' => $this->resource($ticket, AssistKind::SuggestedReply),
        ]);
    }

    public function summary(Request $request, Ticket $ticket): JsonResponse
    {
        return $this->run($request, $ticket, AssistKind::Summary);
    }

    public function reply(Request $request, Ticket $ticket): JsonResponse
    {
        return $this->run($request, $ticket, AssistKind::SuggestedReply);
    }

    public function dismiss(Ticket $ticket): JsonResponse
    {
        $this->authorize('view', $ticket);
        $this->assist->dismiss($ticket);

        return response()->json([], 204);
    }

    private function run(Request $request, Ticket $ticket, AssistKind $kind): JsonResponse
    {
        $this->authorize('view', $ticket);

        if (! config('ai.enabled')) {
            return response()->json(['message' => __('ai.unavailable')], 503);
        }

        try {
            $artifact = $this->assist->generate($ticket, $kind, $request->user());
        } catch (AssistUnavailableException $e) {
            report($e);   // the provider's reason is logged, never returned

            return response()->json(['message' => __('ai.failed')], 503);
        }

        return (new AiAssistArtifactResource($artifact))->response();
    }
}
```

**503, not 500** — this is a dependency being unavailable, and the SPA branches on it to render the failed card rather than the generic error toast.

**Create files: `api/lang/en/ai.php` and `api/lang/ar/ai.php`** — two keys, `unavailable` and `failed`, following `api/lang/{en,ar}/portal.php`. Server-derived copy is localised server-side (the index's cross-cutting rule); `SetLocale` resolves it.

### 8 — Lock the contract

**File: `api/tests/Feature/ApiContractTest.php`** — add one case locking the `show` response's three top-level keys (`enabled`, `summary`, `suggestion`), matching the dashboard-widget shape test at lines 53+.

---

## Frontend Tasks

### 9 — Design tokens and CSS

**File: `web/src/index.css`** — add to the bare `:root` block after line 140 (`--thread-card-radius`), and the dark values to **both** the `prefers-color-scheme` block (~line 249) **and** the `[data-theme="dark"]` block (~line 354), exactly as every other token in this file is defined three times.

| Token | Light | Dark |
|---|---|---|
| `--ai-card-bg` | `#F5F3FF` | `rgba(167, 139, 250, 0.14)` |
| `--ai-card-border` | `#DDD6FE` | `rgba(167, 139, 250, 0.35)` |
| `--ai-chip-bg` | `#7C3AED` | `#8B5CF6` |
| `--ai-chip-fg` | `#FFFFFF` | `#FFFFFF` |
| `--ai-label-fg` | `#5B21B6` | `#C4B5FD` |
| `--ai-body-fg` | `#4C1D95` | `#DDD6FE` |
| `--ai-action-fg` | `#7C3AED` | `#C4B5FD` |
| `--ai-used-bg` | `#ECFDF5` | `rgba(52, 211, 153, 0.14)` |
| `--ai-used-border` | `#A7F3D0` | `rgba(52, 211, 153, 0.35)` |
| `--ai-used-fg` | `#065F46` | `#34D399` |
| `--ai-idle-border` | `#CBD5E1` | `#475569` |
| `--ai-idle-fg` | `#64748B` | `#94A3B8` |

Then add the `.assist-*` rules at the end of the thread block (after line 2299). Requirements, all taken from the artboards:

- `.assist-card` — `background: var(--ai-card-bg); border: 1px solid var(--ai-card-border); border-radius: 10px; padding: 12px 14px;` flex column, `gap: 10px` (composer card) / `gap: 8px` (summary card).
- `.assist-chip` — the `AI` / `AI SUGGESTED REPLY` pill: `background: var(--ai-chip-bg); color: var(--ai-chip-fg); font-size: 10px; font-weight: 700; letter-spacing: .03em; border-radius: 5px; padding: 2px 6px;`.
- `.assist-idle-btn` — `border: 1px dashed var(--ai-idle-border); color: var(--ai-idle-fg); border-radius: 8px; padding: 6px 12px; width: fit-content;`.
- `.assist-used` — `background: var(--ai-used-bg); border: 1px solid var(--ai-used-border); color: var(--ai-used-fg); border-radius: 8px; padding: 8px 12px; width: fit-content;`.
- `.assist-skeleton-line` — reuse the shimmer already used by `.csat-panel-skeleton`; do **not** introduce a second keyframe.
- **Every** directional value uses logical properties (`padding-inline`, `margin-inline-start`, `border-start-start-radius`), as the rest of this file does — the RTL artboard mirrors the whole card. The regenerate icon must **not** be flipped (it is a circular arrow); give it `transform: none` explicitly if a global mirror rule would otherwise catch it.
- Reuse the shared `.fv` focus-visible class on every button; add no new focus treatment.

### 10 — The `ai-assist` feature module

Create `web/src/features/ai-assist/`, following `web/src/features/csat/`.

**Create file: `web/src/features/ai-assist/model/assist.ts`**

```ts
export type AssistArtifact = {
  content: string;
  locale: string;
  model: string;
  created_at: string | null;
  updated_at: string | null;
  dismissed: boolean;
};

export type TicketAssist = {
  enabled: boolean;
  summary: AssistArtifact | null;
  suggestion: AssistArtifact | null;
};

/** The six states from the design reference. `idle` and `dismissed` render the same control but are distinct. */
export type AssistState = 'idle' | 'generating' | 'ready' | 'used' | 'dismissed' | 'failed';
```

**Create file: `web/src/features/ai-assist/api/assistApi.ts`** — four functions over the shared `api` client from `../../../lib/api` (never a second axios instance): `fetchTicketAssist`, `generateSummary`, `generateSuggestion`, `dismissSuggestion`.

**Create file: `web/src/features/ai-assist/api/queryKeys.ts`**

```ts
import { ticketKeys } from '../../tickets/api/queryKeys';

/** Nests under ticketKeys.all so every ticket mutation already invalidates it. */
export const assistKeys = {
  detail: (id: number) => [...ticketKeys.all, 'ai-assist', id] as const,
};
```

This requires exporting `ticketKeys` from `web/src/features/tickets/index.ts` — one added line. It is the index's cross-cutting rule (*"`ticketKeys` is the one TanStack Query keying scheme"*); a private `['ticket-assist', id]` key would leave a stale summary behind after a status change made elsewhere.

**Create file: `web/src/features/ai-assist/hooks/useTicketAssist.ts`** — `useQuery` on `assistKeys.detail(ticketId)`, `enabled: Number.isFinite(ticketId)`.

**Create file: `web/src/features/ai-assist/hooks/useAssistMutations.ts`** — three `useMutation`s that write the result straight into the `assistKeys.detail` cache via `setQueryData` (so the card flips to `ready` without a refetch), plus `invalidateQueries({ queryKey: assistKeys.detail(id) })` on settle.

**Create file: `web/src/features/ai-assist/components/AiSummaryCard.tsx`**

- Renders `null` when `enabled === false`, and `null` during the *initial* query load — an empty violet card would push `TICKET DETAILS` down and back on every open.
- Auto-generates on mount when `enabled && summary === null` and no generation has been attempted this mount — a `useRef` guard, so a failed generation does not retry-loop (Decision 3).
- **generating** → the metadata-panel skeleton from the GENERATING artboard: a 70×16 header bar, a 20×20 button bar, then 100% / 92% / 60% lines. `aria-busy="true"`.
- **ready** → `AI` chip + `TICKET SUMMARY` label + an `aria-label`ed regenerate button + the body + `formatRelative(updated_at)` rendered through `t('assist.summarizedAgo', { time })`.
- **failed** → the inline `Couldn't generate a summary.` + `Retry` row.

**Create file: `web/src/features/ai-assist/components/SuggestedReplyCard.tsx`**

Props: `{ ticketId: number; onUse: (text: string) => void }`. It owns the `used` state locally (`useState`), because "inserted into the composer" is a client-side fact with no server record.

| State | Trigger | Render (from the artboards) |
|---|---|---|
| `idle` | `enabled`, no suggestion row | Dashed `Suggest a reply` button, `width: fit-content`. |
| `generating` | mutation pending | Neutral skeleton card: 130×16 + 20×20 header, 100% / 80% lines, 110×28 + 70×28 buttons. `aria-busy="true"`. |
| `ready` | suggestion present, not dismissed, not used | Violet card: `AI SUGGESTED REPLY` chip, regenerate icon button, body, **Use this reply** (solid) + **Dismiss** (text). |
| `used` | `Use this reply` clicked | Green banner `AI reply inserted into composer — review before sending`, `role="status"`. It **replaces** the card, it does not stack below it. |
| `dismissed` | `Dismiss` clicked, or `dismissed: true` from the API | Back to the `idle` button. |
| `failed` | mutation error, or a 503 | Info glyph + `Couldn't generate a suggestion.` + `Retry`. |

**Use this reply** calls `onUse(content)` and nothing else. It does **not** call the send mutation, and it does **not** clear the composer first — the text is spliced at the caret, so an agent who has already started typing keeps their words. Set the body `dir="auto"` so an Arabic draft reads correctly inside an English UI, as `TicketCsatPanel` does for customer comments.

**Create file: `web/src/features/ai-assist/index.ts`** — the sole public surface: `export { AiSummaryCard }` and `export { SuggestedReplyCard }`. Keep the CSS in `web/src/index.css` per Task 9 — do not split the tokens across two files.

### 11 — Mount it (the only edits to Story 05's files)

**File: `web/src/features/tickets/components/thread/ReplyComposer.tsx`**

Add one prop to `ReplyComposerProps`, after line 21:

```ts
  /**
   * Story 19 (WIS-18) mounts SuggestedReplyCard here. Story 05 reserved the
   * node below for exactly this; the composer's own behaviour is unchanged
   * and a mount that omits this prop still renders the empty slot.
   */
  assistSlot?: React.ReactNode;
```

Destructure it at line 53 and change line 189 to:

```tsx
      <div className="thread-assist-slot">{assistSlot}</div>
```

Delete the now-obsolete "NOT built in this story" comment at lines 184–188 and replace it with a one-line pointer to Story 19. **Nothing else in this file changes** — not the submit path, not the mode tabs, not `insertAtCaret`.

**File: `web/src/features/tickets/components/thread/TicketMetaPanel.tsx`**

Add a second slot prop beside `extraSlot` (line 32):

```ts
  /** Story 19 mounts the AI summary card here — ABOVE "Ticket details", per the design. */
  topSlot?: ReactNode;
```

and render it as the first child of `<aside className="meta-panel">` (line 110), before the `TICKET DETAILS` `<section>`. `extraSlot` keeps its position at line 169 unchanged, so Story 13's CSAT panel does not move.

**File: `web/src/features/tickets/pages/TicketDetailPage.tsx`**

- Import `{ AiSummaryCard, SuggestedReplyCard } from '../../ai-assist';` beside the existing `../../csat` import (line 4).
- Pass `topSlot={<AiSummaryCard ticketId={ticket.id} />}` to `TicketMetaPanel` (line 150).
- Pass `assistSlot={<SuggestedReplyCard ticketId={ticket.id} onUse={(text) => insertAtCaretRef.current?.(text)} />}` to `ReplyComposer` (line 105). `insertAtCaretRef` already exists at line 52 for Stories 09/10 — do not add a second ref.

### 12 — Strings

**File: `web/src/i18n/locales/en/conversation.json`** — already populated by WIS-17. Add a **new top-level `assist` group** beside the existing eleven; touch no existing key.

| Key | English | Arabic (from the RTL artboard) |
|---|---|---|
| `assist.summaryLabel` | `TICKET SUMMARY` | `ملخص التذكرة` |
| `assist.summarizedAgo` | `Summarized {{time}}` | `تم التلخيص {{time}}` |
| `assist.regenerateSummary` | `Regenerate summary` | `إعادة توليد الملخص` |
| `assist.summaryFailed` | `Couldn't generate a summary.` | `تعذر إنشاء الملخص.` |
| `assist.suggestedReplyLabel` | `AI SUGGESTED REPLY` | `رد مقترح بالذكاء الاصطناعي` |
| `assist.regenerateSuggestion` | `Regenerate suggestion` | `إعادة توليد الاقتراح` |
| `assist.suggest` | `Suggest a reply` | `اقتراح رد` |
| `assist.use` | `Use this reply` | `استخدام هذا الرد` |
| `assist.dismiss` | `Dismiss` | `تجاهل` |
| `assist.inserted` | `AI reply inserted into composer — review before sending` | `تم إدراج رد الذكاء الاصطناعي في حقل الكتابة — راجعه قبل الإرسال` |
| `assist.failed` | `Couldn't generate a suggestion.` | `تعذر إنشاء اقتراح.` |
| `assist.retry` | `Retry` | `إعادة المحاولة` |
| `assist.generating` | `Generating…` | `جارٍ الإنشاء…` |

`assist.generating` is screen-reader-only text for the two skeletons; it appears in no artboard because a skeleton has no visible label.

**File: `web/src/i18n/locales/ar/conversation.json`** — the same key set, no exceptions. `catalogueParity.test.ts` fails on the first en-only key in a populated namespace, and this namespace is already populated and already green — an EN-only `assist` key would break a passing test.

**File: `web/scripts/i18n-allowlist.json`** — add one `literals` entry:

```json
{ "value": "AI", "reason": "Story 19 (WIS-18), Decision 6: the AI badge stays Latin in Arabic — the RTL artboard renders it untranslated, and 'ذكاء اصطناعي' triples the two-character pill's width." }
```

Do **not** touch `roots`.

---

## Edge Cases & Failure Modes

- **No API key configured.** `config('ai.enabled')` is false → `AssistGenerator` binds to `UnavailableAssistGenerator` (`AppServiceProvider::register()`), `show` returns `enabled: false` with two nulls, and both cards return `null`. The composer is byte-identical to today. This is the default state of a fresh checkout, so **every existing frontend test must still pass with the cards absent**.
- **Generation fails (timeout, provider 429, 5xx, refusal, empty completion).** `AnthropicAssistGenerator` converts all five to `AssistUnavailableException`; the controller returns **503** with a localised message and `report()`s the cause. The card renders `failed` with `Retry`. **The composer is never disabled, never covered, and never loses its draft** — the intake's hardest constraint, and the subject of tests 5, 6 and 13.
- **The agent has already typed a draft, then presses Use this reply.** `insertAtCaret` (`ReplyComposer.tsx:63–77`) splices at the caret and leaves existing text intact. Do not clear the textarea, and do not move focus — the function already restores it via `requestAnimationFrame`.
- **The suggestion arrives while the agent is mid-word.** The card is a sibling of the composer, not an overlay, so it cannot steal focus. `SuggestedReplyCard` must not call `.focus()` on anything.
- **A regenerate is fired while one is in flight.** The mutation's `isPending` disables both the regenerate icon and `Suggest a reply`. The server side is safe regardless: `updateOrCreate` against the `['ticket_id','kind']` unique index makes the last write win rather than creating a duplicate row.
- **Rate limit hit.** `throttle:ai-assist` returns 429 with `Retry-After`. The SPA renders the same `failed` card — it deliberately does not distinguish "you asked too often" from "the model is down", because the agent's next action (retry later, or reply manually) is identical.
- **A ticket with zero messages.** `AssistTranscript` produces a transcript of just subject/status/priority; the reply system prompt's final sentence covers it ("if the transcript does not contain enough information…"). No special-casing and no client-side guard.
- **A ticket with 900 messages.** Bounded by `config('ai.transcript_messages')` (40, taken newest-first then re-sorted) and `config('ai.transcript_chars')` per message. Cost is O(1) in thread length.
- **An internal note in the thread.** Included in the summary transcript, marked `[INTERNAL NOTE]`. **Excluded from the reply transcript by `publicOnly()` in the query** — `AssistTranscript::forReply()`. Test 4 asserts a note's sentinel text never reaches the reply prompt.
- **An Arabic ticket viewed by an English-UI agent, or the reverse.** The artefact is generated in the *viewer's* locale (`app()->getLocale()`, from `SetLocale`) and the row records it. A cached artefact in the other locale is still served as-is; the agent can press regenerate. Do **not** auto-regenerate on locale change — that silently doubles the bill on every language toggle.
- **An agent without `TicketPolicy@view` on the ticket.** All four routes `authorize('view', $ticket)` and 403 before any provider call, so an unassigned agent cannot bill the account against someone else's ticket.
- **Dismiss, then reload.** `dismissed_at` persists, `show` returns `dismissed: true`, the card renders `idle`. Regenerating clears `dismissed_at`.
- **A model that returns markdown despite the prompt.** The card renders `content` as **plain text in a `<div>`, never `dangerouslySetInnerHTML`**. Stray asterisks are cosmetic; an HTML injection path would not be. `MarkdownRenderer` is not used here.
- **Ticket deleted while a card is open.** `cascadeOnDelete` on `ticket_id` removes the rows; the next `show` 404s through model binding and Story 05's existing thread error path handles it.
- **Uncertainty carried deliberately:** the exact accessor names on the PHP SDK's usage object (`$message->usage->inputTokens`) are written from the documented example shape and are **not** verified against an installed package — the SDK is added by Task 1. If they differ, correct them from the SDK's own types. The token counters are telemetry-only and no test asserts their values, so nothing else in this story depends on the answer.

---

## Test Plan

**Backend** — a new directory `api/tests/Feature/Ai/`, Pest, following `api/tests/Feature/Csat/`. Every test binds a fake `AssistGenerator` in the container; **no test makes a network call.**

1. `AiAssistAccessTest.php` — an agent not assigned to the ticket gets **403** from all four routes and the fake generator is never invoked. An assigned agent and a team lead get 200.
2. `AiAssistDisabledTest.php` — with `config(['ai.enabled' => false])`, `GET .../ai-assist` returns `enabled: false` with two nulls, and both POSTs return **503**.
3. `AiAssistCachingTest.php` — two consecutive `GET`s after one `POST .../summary` invoke the generator exactly **once**; a second `POST` invokes it again and **replaces** the row (assert `ai_assist_artifacts` still holds one row for the pair).
4. `AiAssistPromptTest.php` — the highest-consequence test. Seed a ticket with a public customer message, a public agent reply, and an internal note containing the sentinel `INTERNAL-ONLY-SENTINEL`. Capture the transcript passed to the generator. Assert the sentinel **is** present for `AssistKind::Summary` and **is absent** for `AssistKind::SuggestedReply` (Decision 2).
5. `AiAssistFailureTest.php` — a generator that throws `AssistUnavailableException` produces a **503** with a localised body, writes **no** `ai_assist_artifacts` row, and leaves any previously cached row intact.
6. `AiAssistNeverSendsTest.php` — the guarantee, stated as a test. Generate a suggestion, then assert the `ticket_messages` count is unchanged and no `ticket_events` row was written. Generating is not communicating.
7. `AiAssistDismissTest.php` — `DELETE` sets `dismissed_at`, is idempotent (a second call still 204s), and a subsequent `POST .../reply` clears it.
8. `AiAssistThrottleTest.php` — the 7th `POST` inside a minute returns **429**; `DELETE` still returns 204 while the POST limiter is exhausted, because it is outside the group.
9. `api/tests/Unit/AssistTranscriptTest.php` — unit, no HTTP: the newest-N window is taken from the recent end and re-sorted ascending; per-message clamping at `transcript_chars`; the Arabic locale instruction appears in the system prompt when `app()->setLocale('ar')`.
10. `api/tests/Feature/ApiContractTest.php` — extend with the `show` key-set lock (Task 8).

**Frontend** — Vitest + Testing Library, following `web/src/features/tickets/components/thread/ReplyComposer.test.tsx` and its `testUtils.tsx` render helper.

11. `web/src/features/ai-assist/components/SuggestedReplyCard.test.tsx` — all six states render their documented control; **Use this reply** calls `onUse` with the exact content and does **not** call any send mutation; **Dismiss** issues the DELETE and returns the card to the idle button.
12. `web/src/features/ai-assist/components/AiSummaryCard.test.tsx` — auto-generates once on mount when no summary is cached, does **not** re-fire after a failure (the `useRef` guard), and renders nothing at all when `enabled: false`.
13. `web/src/features/tickets/components/thread/ReplyComposer.test.tsx` — **extend, do not rewrite.** Add one case: with `assistSlot` supplied and the AI request failing, the textarea is still enabled, still accepts input, and Send still fires. This is the composer-never-blocked criterion.
14. `web/src/features/tickets/pages/TicketDetailPage.test.tsx` — **extend.** Assert the summary card renders **above** the `TICKET DETAILS` label in DOM order, and that Story 13's CSAT panel is still in its original position.
15. `web/src/i18n/catalogueParity.test.ts` — no change needed; it already covers the `conversation` namespace. It is green today and must stay green, which is what makes the AR column of Task 12's table non-optional.
16. `web/src/i18n/noHardcodedStrings.test.ts` — no change needed. `src/features/tickets` is not an enforced root, so this story's new files are not scanned; write them with `useT('conversation')` anyway, because WIS-17 adds that root and any literal left behind becomes its problem.

---

## Migration / Rollback

- **Forward:** `php artisan migrate` creates one new table and changes no existing one. `composer require anthropic-ai/sdk` adds one dependency plus its transitive HTTP client.
- **Rollback:** `php artisan migrate:rollback --step=1` drops `ai_assist_artifacts`. Nothing else references it — `tickets`, `ticket_messages` and `ticket_events` are untouched by this story, so a rollback loses cached artefacts and no support history.
- **Half-applied state:** if the migration ran but the code was reverted, the table sits unused and harmless. If the code shipped but the migration did not, every generate 500s on a missing table — so **migrate before deploy**, as with every other story here.
- **Kill switch, no deploy required:** set `AI_ASSIST_ENABLED=false` (or unset `ANTHROPIC_API_KEY`) and clear the config cache. Both cards vanish and the Conversation Thread returns to its Story 05 behaviour exactly. Verify this path **before** the first production enable — it is the rollback that matters.

---

## Verification Steps

1. **Backend builds:** in `api/` — `composer install`, then `php artisan config:clear && php artisan migrate`.
2. **Backend tests:** in `api/` — `php artisan test --filter=Ai` for the new suite, then the full `php artisan test`. The baseline is **419/419 green on local Postgres**; this story must not reduce it.
3. **Frontend runs:** in `web/` — `npm run build` (tsc + vite) and `npm run dev`, then open a ticket with several messages.
4. **Frontend tests:** in `web/` — `npx vitest run`.
5. **Lint + i18n gate:** in `web/` — `npm run lint` (oxlint + `node scripts/check-no-literals.mjs`). Zero violations required; a failure here means either a literal in an enforced root or a malformed allowlist entry.
6. **Regression — the disabled path:** unset `ANTHROPIC_API_KEY` in `api/.env`, run `php artisan config:clear`, reload the ticket. Neither card renders; the composer, KB picker, quick-reply picker and internal-note tabs behave exactly as before.
7. **Regression — the failure path:** point `ANTHROPIC_API_KEY` at an invalid value, reload, press `Suggest a reply`. The failed card appears; then type a reply and send it successfully **while that card is showing**.
8. **Manual — RTL and dark:** switch the UI to Arabic and to dark mode with both cards populated. Compare against `WisalAIAssistPanel-DarkRTL.dc.html`: the card mirrors, the regenerate glyph does not flip, and the `AI` chip stays Latin.
9. **Manual — the no-auto-send guarantee:** press **Use this reply**, then navigate away without sending. Re-open the ticket and confirm `GET /api/tickets/{id}/messages` contains no new message.

---

## Done Criteria

- [x] A ticket-summary card renders at the top of the Conversation Thread metadata panel with a 2–4 line AI summary, an `AI` badge, a regenerate action, and a "Summarized …" staleness line.
- [x] A suggested-reply card renders directly above the reply composer with **Use this reply**, **Dismiss**, and a regenerate action.
- [x] **Use this reply** inserts the text into the composer as editable content at the caret, preserving any draft already typed, and **never sends it** — verified by test 6 (no `ticket_messages` row) and test 11 (no send mutation).
- [x] All AI-produced content is visually distinguishable from agent-authored content: the violet `--ai-card-*` surface plus the `AI` chip, in light and dark, LTR and RTL.
- [x] All six states ship on the suggested reply (idle / generating / ready / used / dismissed / failed) and all three on the summary (generating / ready / failed), matching `docs/design/references/17.WisalAIAssistPanel/`.
- [x] A generation failure — provider error, timeout, 429, refusal, or no key at all — leaves the composer fully usable, and an agent can reply without AI assistance.
- [x] With `AI_ASSIST_ENABLED=false` or no key, neither card renders and the Conversation Thread is byte-identical to its Story 05 behaviour.
- [x] `TicketPolicy@view` gates all four endpoints; `throttle:ai-assist` gates the two generating ones; `DELETE` is deliberately outside the throttle.
- [x] The suggested-reply prompt is built from `publicOnly()` messages **in the query**; an internal note cannot reach a customer-facing draft (test 4).
- [x] Story 05's layout is otherwise unchanged: `ReplyComposer` gains one optional prop and fills its own reserved slot; `TicketMetaPanel` gains one optional prop; Story 13's CSAT panel has not moved.
- [x] Every new string ships in `conversation.json` for **both** `en` and `ar`; `web/src/i18n/catalogueParity.test.ts` is green.
- [x] `php artisan test` is 419+/419+ green, and `npx vitest run` + `npm run lint` are green.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 20.**
