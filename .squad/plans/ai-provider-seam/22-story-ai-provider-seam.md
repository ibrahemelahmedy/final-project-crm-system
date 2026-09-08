# Story 22 — Free AI Provider Behind the AssistGenerator Seam: Gemini / Groq (Story: WIS-26)

---

## Prerequisites

- **Story 19 completed** ([`../ai-assist-panel/19-story-ai-assist-panel.md`](../ai-assist-panel/19-story-ai-assist-panel.md)) — owns every artefact this story extends: the interface `App\Services\Ai\AssistGenerator` (`api/app/Services/Ai/AssistGenerator.php:13–21`), `AssistResult` (`AssistResult.php:8–16`), `AnthropicAssistGenerator` (63 lines), `UnavailableAssistGenerator` (19 lines), `AssistTranscript`, `TicketAssist`, `App\Exceptions\AssistUnavailableException` (a bare `extends \RuntimeException`), `api/config/ai.php` (32 lines), `TicketAssistController`, the `ai_assist_artifacts` table, the `throttle:ai-assist` limiter, `api/lang/{en,ar}/ai.php`, and `web/src/features/ai-assist/**`. **Its decisions remain binding** — in particular Decision 1 (one provider seam, bound in `AppServiceProvider`), Decision 3 (a failed generate does not self-retry; the agent presses Retry), and the rule that every consumer checks `config('ai.enabled')`, never `config('ai.key')`.
- **Story 18 completed** ([`../integrations-erp/18-story-integrations-erp-admin.md`](../integrations-erp/18-story-integrations-erp-admin.md)) — `App\Services\HttpIntegrationTester` (`api/app/Services/HttpIntegrationTester.php:52–74`) is the in-repo precedent for an outbound call through the `Http` facade: explicit `timeout()` + `connectTimeout()`, a `catch (Throwable)`, and the comment at `:67–70` explaining why **the provider's exception message is never stored or returned** — a Guzzle message can embed the request headers, and `Authorization` carries the key. This story copies that discipline exactly.
- **No coordination needed with any unfinished story.** This story adds no schema, no route, no resource key and no frontend module.
- **Blocks WIS-23** (AI auto-classify + chatbot), which needs a no-cost generator to call per inbound ticket. WIS-23 will want a *structured/JSON* answer; that is **not** built here (see Story Goal, "Explicitly NOT in scope").

---

## Story Goal

Make the AI Assist cards work on a machine with **no paid key** — a Groq or Google AI Studio free key, chosen by one `.env` line — without the rest of the application knowing which provider answered.

1. **One new implementation, two providers.** `App\Services\Ai\OpenAiCompatibleAssistGenerator` speaks the OpenAI `POST {base}/chat/completions` shape that **both** Groq and Google AI Studio expose. Base URL, model and key are constructor arguments, so the same class *is* the Groq provider and *is* the Gemini provider. **No `GroqAssistGenerator`, no `GeminiAssistGenerator`** (Decision 1).
2. **`AI_PROVIDER` selects, and nothing else changes.** `config('ai.provider')` is `anthropic` | `gemini` | `groq`; `config('ai.enabled')` is true when **the selected provider's** key is present. `AppServiceProvider` binds by provider.
3. **Identical failure behaviour.** Every provider fault — transport error, 401/429/5xx, a content-filter refusal, an empty completion — becomes `AssistUnavailableException`, which `TicketAssistController::run()` (`api/app/Http/Controllers/TicketAssistController.php:62–68`) already turns into `503 __('ai.failed')` and the SPA already renders as the `failed` card. **No new HTTP status, no new lang key, no 500.**
4. **The frontend is untouched.** `AiSummaryCard.tsx:21,35` gates on `enabled`, which is `(bool) config('ai.enabled')` (`TicketAssistController.php:30`). Turning `enabled` true for a free key **is** the whole fix for "the cards render nothing".
5. **One command to prove it with a real key.** `php artisan ai:smoke` resolves the bound generator, calls it against a real ticket, and prints provider / model / tokens / output, so the owner discharges the two key-dependent Done Criteria in one line after pasting a key.

**Explicitly NOT in scope:**

- **No change to `AssistGenerator`'s signature.** `generate(string $system, string $transcript): AssistResult` is frozen. A JSON/structured-output variant belongs to WIS-23.
- **No frontend change, no new i18n string, no new `api/lang` key.** If the executor is editing anything under `web/`, the design has gone wrong.
- **No migration.** Do **not** widen `ai_assist_artifacts.model` (`api/database/migrations/2026_09_03_100000_create_ai_assist_artifacts_table.php:22`, `string(64)`) — clamp the value in the generator instead (Task 2, Decision 6).
- **No new composer dependency.** `illuminate/http` ships with the framework (Decision 2).
- **`AnthropicAssistGenerator` is not deleted, and `anthropic-ai/sdk` stays in `api/composer.json:10`.** Anthropic remains a selectable provider and remains the default.
- **No streaming, no tool use, no retry/backoff, no extra caching.** One request, one answer, one failure mode.
- **No live-key call in any test.** Every test added here runs under `Http::fake()`.

---

## Context — Read These Files First

1. `api/app/Services/Ai/AssistGenerator.php` — the whole file (21 lines). One method; the `@throws` contract at `:16–19` is the reason this story exists in this shape. **Not edited.**
2. `api/app/Services/Ai/AnthropicAssistGenerator.php` — the whole file (63 lines). This is the template to mirror, in this order: `catch (RateLimitException|APIStatusException|APIConnectionException)` → `AssistUnavailableException` (`:34–36`); **refusal checked before content is read** (`:38–42`); text accumulated across blocks rather than indexed at `[0]` (`:44–50`); whitespace-only text → `'empty completion'` (`:52–54`); `AssistResult` built from the response's own `model` with a config fallback (`:56–61`). **Not edited by this story.**
3. `api/app/Services/Ai/UnavailableAssistGenerator.php` (19 lines) and `api/app/Services/Ai/AssistResult.php` (16 lines) — read both end-to-end; `AssistResult` is a 4-field `final readonly class` and is **not** changed.
4. `api/app/Services/HttpIntegrationTester.php:52–74` — the `Http::withOptions(...)->timeout(5)->connectTimeout(3)` + `catch (Throwable)` + `Log::warning('…', ['host' => $host])` pattern. Read the comment at `:67–70` before writing any `catch` block in Task 2.
5. `api/config/ai.php` — the whole file (32 lines). Note exactly which keys exist today: `enabled` `:9`, `key` `:11`, `model` `:14`, `effort` `:18`, `max_tokens` `:22`, `timeout` `:25`, `transcript_messages` `:28`, `transcript_chars` `:31`. **`transcript_messages` and `transcript_chars` are read by `AssistTranscript` at `api/app/Services/Ai/AssistTranscript.php:67` and `:117` — they keep their names and their top-level position.** `effort` is Anthropic-only and is read at `AnthropicAssistGenerator.php:32`.
6. `api/app/Providers/AppServiceProvider.php:57–67` — the `IntegrationConnectionTester` bind, then the `Anthropic\Client` singleton (`:63`) and the `AssistGenerator` bind (`:65–67`). **Both are closures, resolved lazily** — confirm that for yourself, because Task 3 depends on the `Client` closure never running when the provider is `groq`.
7. `api/app/Http/Controllers/TicketAssistController.php` — `:30` (`'enabled' => (bool) config('ai.enabled')`), `:58–60` (the disabled 503), `:62–68` (the `AssistUnavailableException` → `report($e)` → `503 __('ai.failed')` mapping). **This is the "existing `failed` state" of Done Criterion 4.** Not edited.
8. `api/tests/Pest.php:33–115` — `bindAssistGenerator()` and `bindFailingAssistGenerator()`, plus the docblock at `:33–47` warning that a controller instance is cached on the `Route` object, so a second `app()->instance()` mid-test has no effect. **This file is not edited by this story** (Done Criterion 5 says so in as many words).
9. Grep `config(\['ai\.` under `api/tests/` — **nine hits, in nine files**: the eight `api/tests/Feature/Ai/AiAssist*Test.php` files (`Access:11`, `Caching:12`, `Disabled:11`, `Dismiss:12`, `Failure:12`, `NeverSends:18`, `Prompt:18`, `Throttle:11`) and `api/tests/Feature/ApiContractTest.php:346`. Every one sets `ai.enabled` **at runtime**; none reads `ai.key`, constructs `AnthropicAssistGenerator`, or opens a socket. Re-run this grep as step 0 of Task 7 and confirm the count is still nine before you touch anything.
10. `api/tests/Feature/Admin/IntegrationSsrfTest.php:1–24` — the repo's `Http::fake()` precedent: `Http::fake()` in `beforeEach`, the real service resolved from the container, `Http::assertNothingSent()`. Task 7's new tests follow this shape, not the `bindAssistGenerator()` shape.
11. `api/database/migrations/2026_09_03_100000_create_ai_assist_artifacts_table.php:17–32` — the column widths. **`model` is `string(64)`**; `input_tokens` / `output_tokens` are `unsignedInteger` with default `0`.
12. `api/.env.example:67–69` — the existing three-line AI block. `README.md:119–126` (the "What the seed contains" paragraph in §1), `README.md:182` (the Category-7 row), `README.md:762–763` (the "AI features are partial" gap bullet) — the three documentation anchors.
13. `api/app/Console/Commands/EvaluateSlaCommand.php` — the repo's console-command style (signature, description, `$this->info`/`$this->error`, `return self::SUCCESS|self::FAILURE`). Task 5 copies it.
14. `web/src/features/ai-assist/components/AiSummaryCard.tsx:21,35` and `web/src/features/ai-assist/model/assist.ts:1–14` — read only to confirm the claim in Story Goal 4: `enabled` is the single gate, `model` is typed `string` and never rendered. **Change nothing here.**

---

## Decisions

These are settled. Do not re-litigate them during implementation.

**Decision 1 — one `OpenAiCompatibleAssistGenerator`, not a class per provider.**
Groq and Google AI Studio differ, for this workload, in exactly three values: base URL, model id, and API key. A `GroqAssistGenerator` and a `GeminiAssistGenerator` would be the same 60 lines twice with three constants swapped, and every future bug would need fixing twice. One class takes those three values as **constructor arguments**; `AppServiceProvider` supplies them from `config('ai.providers.<provider>')`. The class therefore reads **no per-provider config itself**, which is what makes it testable by construction rather than by config juggling. (It still reads the three provider-agnostic knobs — `ai.timeout`, `ai.max_tokens`, `ai.temperature` — through `config()`, exactly as `AnthropicAssistGenerator` does.)

**Decision 2 — Laravel's `Http` facade, no SDK.**
`illuminate/http` already ships with the framework and `HttpIntegrationTester` already establishes the house style for an outbound call. `openai-php/client` would be a new runtime dependency, would drag in its own exception hierarchy that then has to be mapped anyway, and buys nothing for a single non-streaming POST. **Do not add a composer package for this story.** `api/composer.json` is not edited.

**Decision 3 — `config/ai.php` grows a `providers` map; the existing top-level keys stay and stay meaningful.**
`ai.key` and `ai.model` continue to exist and now resolve to **the selected provider's** key and model. That is deliberate backward compatibility: `AnthropicAssistGenerator.php:23,27,58` reads `config('ai.model')` and `AppServiceProvider.php:63` reads `config('ai.key')`, and neither file is edited by this story. `effort` stays top-level and stays Anthropic-only. `transcript_messages` and `transcript_chars` stay top-level and stay where `AssistTranscript` looks for them.

**Decision 4 — `enabled` is derived from the selected provider, at config-load time, and an unknown provider disables the feature.**
`AI_PROVIDER=llama-on-my-toaster` is a typo, not a request to crash. It resolves to no provider entry, so `enabled` is `false`, the binding returns `UnavailableAssistGenerator`, the cards do not render, and both generate routes answer `503`. **No exception is thrown at boot** — a config file that throws breaks `artisan config:cache` and every console command with it.

**Decision 5 — the system prompt travels as a `system` message, not prepended to the user turn.**
`AssistTranscript` hands back `[$system, $transcript]` and the OpenAI shape has a first-class `system` role. Send `messages: [{role: system, …}, {role: user, …}]`. Groq and Gemini's compat layer both accept it. Do **not** concatenate the two strings — the summary/reply system prompts (`AssistTranscript.php:21,23`) are long and stable, and keeping them in their own turn is what lets a provider cache them.

**Decision 6 — the model id written to `AssistResult` is clamped to 64 characters.**
`ai_assist_artifacts.model` is `string(64)`. An OpenAI-compatible response echoes the provider's own id for the model, which is not guaranteed to equal what was requested (Gemini's compat layer can answer `models/gemini-2.0-flash`; a Groq preview id can be long). An over-long value would throw a `QueryException` from `AiAssistArtifact::updateOrCreate` (`api/app/Services/Ai/TicketAssist.php:45–57`) — which is **not** an `AssistUnavailableException`, would escape `TicketAssistController`'s catch, and would surface as a **500**, breaking Done Criterion 4. Clamp with `Str::limit($value, 64, '')` (the third argument suppresses the `…` suffix, which would otherwise make the result 67 characters).

**Decision 7 — the exception message never carries provider text.**
`AnthropicAssistGenerator.php:35` passes `$e->getMessage()` through. The SDK's messages are known-safe; a Guzzle `RequestException`'s message is not — it can embed the request line and a slice of the response body, and a badly behaved provider can echo the `Authorization` header. So the new generator's messages are **constructed, not forwarded**: `"{provider} http {status}"`, `'refused'`, `'empty completion'`, `'transport failure'`. The original throwable is still attached as `previous:`, and `TicketAssistController::run()` already calls `report($e)`, so operators lose nothing. This is a **deliberate deviation** from Anthropic's line and must be preserved.

**Decision 8 — a `429` is a plain `AssistUnavailableException`, with no retry and no backoff.**
Free tiers rate-limit, and the SPA already has a Retry button (Story 19 Decision 3). Retrying inside a synchronous request the SPA is waiting on (budget: `config('ai.timeout')`, 30s) is how a 30-second wait becomes a 90-second wait. **No `->retry()` on the `Http` call.**

**Decision 9 — `finish_reason: 'length'` with non-empty content is a success.**
A truncated summary is more useful than a failed card, and `max_tokens` is 4096 against a 2-to-4-line artefact, so this only fires on a runaway model. `length` with *empty* content falls through to the `'empty completion'` branch like any other empty answer.

**Decision 10 — the smoke command is `ai:smoke`, and it is the only new console command.**
It is how Done Criteria 1 and 2 get ticked, because they need a real key that does not exist at implementation time. It resolves `AssistGenerator` from the container (so it exercises the *real* binding, not a hand-built object), builds a real prompt through `AssistTranscript`, and prints what came back.

---

## Backend Tasks

`No frontend changes required.` Nothing under `web/` is edited by this story. If a change to `web/` seems necessary, stop and re-read Story Goal 4.

### 1 — Restructure `api/config/ai.php`

**File:** `api/config/ai.php` (currently 32 lines; replace the whole file).

```php
<?php

/*
 * Story 19 (WIS-18) built this file for one paid provider. Story 22 (WIS-26)
 * turned it into a provider registry: `AI_PROVIDER` picks one entry from
 * `providers`, and `enabled` follows THAT entry's key. An unknown provider
 * name resolves to no entry, which disables the feature — it never throws,
 * because a config file that throws breaks `artisan config:cache`.
 */

$provider = env('AI_PROVIDER', 'anthropic');

$providers = [
    // Paid. Uses the official SDK via AnthropicAssistGenerator.
    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        // Do NOT append a date suffix; this id is complete as written.
        'model' => env('AI_ASSIST_MODEL', 'claude-opus-5'),
        'base_url' => null, // the SDK owns its own endpoint
    ],

    // Free tier. OpenAI-compatible; served by OpenAiCompatibleAssistGenerator.
    'groq' => [
        'key' => env('GROQ_API_KEY'),
        'model' => env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
        'base_url' => env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
    ],

    // Free tier (Google AI Studio). Also OpenAI-compatible.
    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-2.0-flash'),
        'base_url' => env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
    ],
];

$selected = $providers[$provider] ?? null;

return [
    // Which entry of `providers` is live. Never trusted blindly — see `enabled`.
    'provider' => $provider,

    'providers' => $providers,

    /*
     * AI Assist is OFF unless the SELECTED provider's key is present. Every
     * consumer checks `enabled` — never `key` — so a deployment can disable
     * the feature without discarding its credential.
     */
    'enabled' => env('AI_ASSIST_ENABLED', true) && $selected !== null && filled($selected['key']),

    // Back-compat: the selected provider's credential and model. Read by
    // AppServiceProvider's Anthropic\Client singleton and by
    // AnthropicAssistGenerator, neither of which this story edits.
    'key' => $selected['key'] ?? null,
    'model' => $selected['model'] ?? env('AI_ASSIST_MODEL', 'claude-opus-5'),

    // Anthropic-only. Read at AnthropicAssistGenerator.php:32.
    'effort' => env('AI_ASSIST_EFFORT', 'low'),

    // Adaptive thinking is on by default on claude-opus-5 and its tokens
    // count against this ceiling, so it is not sized to the visible output.
    'max_tokens' => (int) env('AI_ASSIST_MAX_TOKENS', 4096),

    // OpenAI-compatible providers only. Low, because both artefacts are
    // factual restatements of a transcript, not creative writing.
    'temperature' => (float) env('AI_ASSIST_TEMPERATURE', 0.3),

    // Seconds. Story 19 Decision 4 — the synchronous budget the SPA waits on.
    // Applied for real by OpenAiCompatibleAssistGenerator.
    'timeout' => (int) env('AI_ASSIST_TIMEOUT', 30),

    // The newest N messages fed to the model. Bounds cost on a long thread.
    'transcript_messages' => (int) env('AI_ASSIST_TRANSCRIPT_MESSAGES', 40),

    // Per-message character clamp inside the transcript.
    'transcript_chars' => (int) env('AI_ASSIST_TRANSCRIPT_CHARS', 2000),
];
```

**Do not** rename or move `transcript_messages` / `transcript_chars` — `AssistTranscript.php:67` and `:117` read them by those exact paths.

### 2 — Create the OpenAI-compatible generator

**Create file:** `api/app/Services/Ai/OpenAiCompatibleAssistGenerator.php`

```php
<?php

namespace App\Services\Ai;

use App\Exceptions\AssistUnavailableException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * Story 22 (WIS-26), Decision 1 — ONE class for every OpenAI-compatible
 * provider. Groq and Google AI Studio both serve
 * `POST {base}/chat/completions` with a Bearer key, so base URL + model + key
 * are constructor arguments and AppServiceProvider supplies them from
 * config('ai.providers.<provider>'). Adding a third such provider is a config
 * entry, not a class.
 *
 * Every failure path ends in AssistUnavailableException — see Decision 7:
 * the message is CONSTRUCTED, never forwarded from the provider or from
 * Guzzle, because a Guzzle message can embed the Authorization header.
 */
final class OpenAiCompatibleAssistGenerator implements AssistGenerator
{
    public function __construct(
        private string $provider,   // 'groq' | 'gemini' — for log/exception text only
        private string $baseUrl,
        private string $apiKey,
        private string $model,
    ) {}

    public function generate(string $system, string $transcript): AssistResult
    {
        try {
            $response = Http::withToken($this->apiKey)
                ->timeout((int) config('ai.timeout'))
                ->connectTimeout(10)
                ->acceptJson()
                ->asJson()
                ->post(rtrim($this->baseUrl, '/').'/chat/completions', [
                    'model' => $this->model,
                    // Decision 5 — the system prompt is its own turn.
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => $transcript],
                    ],
                    'max_tokens' => (int) config('ai.max_tokens'),
                    'temperature' => (float) config('ai.temperature'),
                ]);
        } catch (Throwable $e) {
            // Connection refused, DNS failure, timeout. NEVER $e->getMessage().
            throw new AssistUnavailableException(
                $this->provider.' transport failure', previous: $e
            );
        }

        // 401 / 403 / 429 / 5xx all land here. No retry (Decision 8).
        if ($response->failed()) {
            throw new AssistUnavailableException(
                $this->provider.' http '.$response->status()
            );
        }

        $data = $response->json();
        $choice = $data['choices'][0] ?? null;

        // A content filter declines with HTTP 200. Check BEFORE reading
        // content, or an empty draft lands in the composer.
        if (($choice['finish_reason'] ?? null) === 'content_filter') {
            throw new AssistUnavailableException('refused');
        }

        $text = trim((string) ($choice['message']['content'] ?? ''));

        // Decision 9 — `length` with content is a success; empty is not.
        if ($text === '') {
            throw new AssistUnavailableException('empty completion');
        }

        return new AssistResult(
            $text,
            // Decision 6 — ai_assist_artifacts.model is string(64).
            Str::limit((string) ($data['model'] ?? $this->model), 64, ''),
            (int) ($data['usage']['prompt_tokens'] ?? 0),
            (int) ($data['usage']['completion_tokens'] ?? 0),
        );
    }
}
```

**Notes for the executor:**

- `Http::withToken()` sets `Authorization: Bearer <key>` — that is what both providers document. Do not add an `x-api-key` header, and do not put the key in the query string.
- `$response->failed()` is true for any 4xx/5xx. **Do not** call `->throw()`; the point is to map, not to propagate.
- `$response->json()` returns `null` on a non-JSON body, so `$data['choices'][0] ?? null` must be written with the null-safe `??` chain exactly as above — an HTML error page from a proxy must produce `'empty completion'`, not a `TypeError`. Guard `$data` being `null` by using `$data['choices'][0] ?? null` on a nullable array — in PHP 8.3 `null['choices']` inside `??` is suppressed, but write `$data = $response->json() ?? [];` to make it explicit.
- The class is `final` and implements `AssistGenerator`; it adds **no public method** beyond `generate()`.

### 3 — Bind by provider in `AppServiceProvider`

**File:** `api/app/Providers/AppServiceProvider.php`

Replace the `AssistGenerator` bind at `:65–67`. Leave the `Anthropic\Client` singleton at `:63` **exactly as it is** — it is a closure and is only resolved when `AnthropicAssistGenerator` is actually made, so a Groq deployment with no `ANTHROPIC_API_KEY` never runs it.

Add `use App\Services\Ai\OpenAiCompatibleAssistGenerator;` to the import block (alphabetically after `AssistGenerator`, before `UnavailableAssistGenerator`, so `pint` stays happy).

```php
        // Story 19 (WIS-18) / Story 22 (WIS-26): the AI provider seam, now
        // selected by `AI_PROVIDER`. Bound to the unavailable implementation
        // when no key is configured OR the provider name is unknown, so a
        // misconfigured deployment degrades to "no cards" instead of a 500 on
        // every ticket open. Resolved lazily, like ArticleSearch above —
        // nothing may read config or open a connection while the container boots.
        $this->app->singleton(Client::class, fn () => new Client(apiKey: (string) config('ai.key')));

        $this->app->bind(AssistGenerator::class, function ($app) {
            if (! config('ai.enabled')) {
                return $app->make(UnavailableAssistGenerator::class);
            }

            $name = (string) config('ai.provider');
            $config = config('ai.providers.'.$name);

            return match ($name) {
                'anthropic' => $app->make(AnthropicAssistGenerator::class),
                'groq', 'gemini' => new OpenAiCompatibleAssistGenerator(
                    provider: $name,
                    baseUrl: (string) ($config['base_url'] ?? ''),
                    apiKey: (string) ($config['key'] ?? ''),
                    model: (string) ($config['model'] ?? ''),
                ),
                // Unreachable while `enabled` is derived from the same map
                // (config/ai.php), but a runtime config() override in a test
                // can reach it. Never throw here.
                default => $app->make(UnavailableAssistGenerator::class),
            };
        });
```

**This must stay a `bind`, not a `singleton`** — the tests in Task 7 change `config('ai.provider')` at runtime and then resolve, and a singleton would hand back the first instance built.

### 4 — `.env.example`

**File:** `api/.env.example` — replace the three-line block at `:67–69`:

```dotenv
# Story 19 (WIS-18) / Story 22 (WIS-26) — AI Assist.
# AI_PROVIDER picks ONE of the three below. `enabled` follows THAT provider's
# key: an unset key (or an unknown provider name) = feature off, no UI, no errors.
AI_PROVIDER=groq
AI_ASSIST_ENABLED=true

# anthropic — paid.
ANTHROPIC_API_KEY=

# groq — free tier. Key from https://console.groq.com/keys
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# gemini — free tier. Key from https://aistudio.google.com/apikey
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

`GROQ_BASE_URL` and `GEMINI_BASE_URL` are **not** listed — they have working defaults in `config/ai.php` and exist only as an escape hatch if a provider moves its endpoint. Leaving them out of `.env.example` keeps the file readable; the config file documents them.

**`AI_PROVIDER=groq` is the committed default** so a fresh clone with a free key pasted in works with no second edit. With no key at all, `enabled` is `false` and behaviour is identical to today.

### 5 — The smoke command

**Create file:** `api/app/Console/Commands/AiSmokeCommand.php`

Follow the style of `api/app/Console/Commands/EvaluateSlaCommand.php` (signature, `$this->info`/`$this->error`, `self::SUCCESS` / `self::FAILURE`).

```php
protected $signature = 'ai:smoke {--kind=summary : summary|reply} {--ticket= : ticket id; defaults to the newest ticket that has messages}';

protected $description = 'Call the configured AI provider once against a real ticket and print what came back.';
```

Behaviour:

1. If `! config('ai.enabled')`, print the provider name and `AI assist is disabled (no key for provider "<name>").` and return `self::FAILURE`.
2. Resolve the ticket: `--ticket` if given, else `Ticket::query()->whereHas('messages')->latest('id')->first()`. If none, error `No ticket with messages found. Run: php artisan migrate:fresh --seed` and return `self::FAILURE`.
3. Build the prompt through the **real** `AssistTranscript`: `forSummary($ticket, app()->getLocale())` or `forReply(...)` per `--kind`.
4. `app(AssistGenerator::class)->generate($system, $prompt)` inside a `try`. On `AssistUnavailableException`, print `Provider unavailable: {$e->getMessage()}` and return `self::FAILURE`.
5. On success print, one per line: provider (`config('ai.provider')`), generator class (`get_class($generator)`), returned model, `input_tokens`/`output_tokens`, then a blank line and the content. Return `self::SUCCESS`.

**It must resolve `AssistGenerator` from the container**, not construct one — the point is to prove the *binding* works, which is Done Criterion 3.

No route, no scheduling entry, no `Kernel` registration (Laravel 13 auto-discovers `app/Console/Commands`).

### 6 — Documentation

**File:** `README.md`

1. **`:182`** — replace the Category-7 row's third cell so it names the provider seam and its free option:

   `| 7 | AI Features | ⚠️ Partial | Ticket summary and suggested reply, `api/app/Services/Ai` + `web/src/features/ai-assist`. Provider-selectable via `AI_PROVIDER` — `anthropic` (paid), `groq` or `gemini` (free tiers), same seam. Auto-classification and a chatbot are not built | WIS-18, WIS-26 |`

2. **After `:126`** (the end of the "What the seed contains" paragraph, before the blank line preceding `The SLA engine is a scheduled command…` at `:128`) — insert a short paragraph, **not** a new heading:

   > **Turning AI Assist on.** The summary and suggested-reply cards are off until a key is present. Set `AI_PROVIDER` in `api/.env` to `groq` or `gemini` — both have a free tier — paste the matching `GROQ_API_KEY` / `GEMINI_API_KEY`, run `php artisan config:clear`, then `php artisan ai:smoke` to confirm the provider answers. `AI_PROVIDER=anthropic` uses the paid Claude path instead. With no key set, the cards do not render and nothing errors.

3. **`:762–763`** — extend the "AI features are partial" bullet with one clause: `…auto-classification and a customer-facing chatbot are not. The provider behind them is selectable (`AI_PROVIDER`), so the feature runs on a free tier — see [1. Run it in 60 seconds](#1-run-it-in-60-seconds).`

**Do not** add a new `##` section to the README, and do not touch `STATUS.md` (the pipeline's run log is the live state for this work).

### 7 — Tests

See **## Test Plan** below for the full list. Task ordering note: **step 0 is the grep in Context item 9.** If it now returns anything other than the nine known files, stop and report — a test has appeared since plan time that may depend on the old config shape.

---

## Edge Cases & Failure Modes

- **Unknown `AI_PROVIDER` value** (`AI_PROVIDER=openai`, a typo) → `$providers['openai'] ?? null` is `null` in `config/ai.php`, so `enabled` is `false`, `key`/`model` fall back, `GET /ai-assist` answers `enabled:false`, both generate routes answer `503`, and the container returns `UnavailableAssistGenerator`. **Nothing throws at boot** and `artisan config:cache` still succeeds. Enforced in Task 1 (`$selected = $providers[$provider] ?? null;`) and Task 3 (the `default =>` arm).
- **Provider selected, key missing** (`AI_PROVIDER=groq`, empty `GROQ_API_KEY`) → `filled(null)` is false → `enabled` false → identical to the case above. This is the case a fresh clone hits.
- **`ANTHROPIC_API_KEY` set but `AI_PROVIDER=groq` and no Groq key** → `enabled` is **false**. The Anthropic key is deliberately ignored: `enabled` follows the *selected* provider only. Called out because it is the one behaviour change a reader could mistake for a regression.
- **Provider returns 429 (free-tier rate limit)** → `$response->failed()` → `AssistUnavailableException('groq http 429')` → `503 __('ai.failed')` → the SPA's `failed` card with a Retry button (`AiSummaryCard.tsx:72–85`). **No automatic retry** (Decision 8).
- **Provider returns 401** (revoked or mistyped key) → identical path to 429. The user sees "failed", not "unauthorised" — the provider's auth state is not the agent's business.
- **Provider returns 200 with `finish_reason: "content_filter"`** → `'refused'` before any content read. Mirrors `AnthropicAssistGenerator.php:38–42`.
- **Provider returns 200 with `content: ""` or whitespace, or with no `choices` array at all** → `'empty completion'`. A `null` body (an HTML proxy error page served as 200) takes the same branch because `$data = $response->json() ?? []`.
- **Provider returns 200 with `finish_reason: "length"` and real content** → **success**, content returned as-is (Decision 9).
- **Connection refused / DNS failure / read timeout past `config('ai.timeout')`** → Guzzle throws, the `catch (Throwable)` maps it to `'{provider} transport failure'` with the original as `previous`. `report()` in `TicketAssistController.php:65` logs it. **The provider's own message never reaches the response body, the exception message, or the log line the caller controls** (Decision 7).
- **Response `model` longer than 64 characters** → clamped by `Str::limit(..., 64, '')` before it reaches `AiAssistArtifact::updateOrCreate`. Without the clamp this is a `QueryException` → **500**, not the `failed` card. Explicitly tested (Test 9).
- **`usage` absent from the response** → both token counts default to `0`; the column is `unsignedInteger` with default `0`, so the insert succeeds. Nothing in the UI renders token counts.
- **Two agents press Regenerate on the same ticket simultaneously** → unchanged from Story 19: `updateOrCreate` on the `(ticket_id, kind)` unique index; last write wins. This story adds no new concurrency surface.
- **`config:cache` in production** — `config/ai.php` computes `$provider`/`$providers` at load, so a cached config bakes in the values that were in `.env` at cache time. **Changing `AI_PROVIDER` requires `php artisan config:clear` (or a re-`config:cache`)**, exactly as changing `ANTHROPIC_API_KEY` does today. Stated in the README paragraph in Task 6.
- **Tests that set `config(['ai.enabled' => true])` but no provider** → `config('ai.provider')` still returns whatever the environment gave (default `anthropic`), so the binding would try to build `AnthropicAssistGenerator`. **Every existing AI test binds a fake through `bindAssistGenerator()` before hitting a route**, and `app()->instance()` wins over the `bind` closure, so the closure never runs. Verified against all nine files at plan time; re-verify by running the suite.

---

## Test Plan

**Nothing in `api/tests/Pest.php` is edited**, and none of the nine existing files listed in Context item 9 is edited. Three new files are added.

### A — `api/tests/Feature/Ai/OpenAiCompatibleAssistGeneratorTest.php` (new)

Follow `api/tests/Feature/Admin/IntegrationSsrfTest.php:1–24`: `Http::fake([...])` per test, the generator constructed directly (it takes constructor arguments — no container needed), no `RefreshDatabase` (nothing here touches the database). Add `Http::preventStrayRequests();` in a `beforeEach` so a missed fake fails loudly instead of hitting the network.

1. **`it('maps a successful completion to an AssistResult')`** — fake `api.groq.com/*` returning `{choices:[{message:{content:' Two short lines. '}, finish_reason:'stop'}], usage:{prompt_tokens:120, completion_tokens:44}, model:'llama-3.3-70b-versatile'}`. Assert `content` is trimmed, `model`, `inputTokens` 120, `outputTokens` 44.
2. **`it('posts the OpenAI chat-completions shape with a bearer token')`** — same fake, then `Http::assertSent()` checking: URL ends `/chat/completions`, header `Authorization: Bearer test-key`, `messages[0].role === 'system'` carrying the system string, `messages[1].role === 'user'` carrying the transcript, `model`, `max_tokens` = `config('ai.max_tokens')`, `temperature` = `config('ai.temperature')`.
3. **`it('works against the gemini base url with no code change')`** — construct with `provider:'gemini'`, the Gemini base URL and model; fake `generativelanguage.googleapis.com/*`; assert the request went to `…/v1beta/openai/chat/completions`. **This is the class-covers-both-providers claim, stated as a test.**
4. **`it('maps a 429 to AssistUnavailableException without leaking the key')`** — fake a 429 with a body containing the literal string `test-key`; assert the thrown message is `'groq http 429'` and `expect($e->getMessage())->not->toContain('test-key')`.
5. **`it('maps a 500 to AssistUnavailableException')`**.
6. **`it('maps a connection failure to AssistUnavailableException')`** — `Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException('cURL error 28'))`; assert the message is `'groq transport failure'` and does **not** contain `cURL`.
7. **`it('treats finish_reason content_filter as a refusal')`** — 200 with `finish_reason:'content_filter'` **and** non-empty content; assert `'refused'` (proving the refusal is checked before the content, mirroring `AnthropicAssistGenerator.php:38–42`).
8. **`it('treats an empty or whitespace completion as unavailable')`** — a dataset over `''`, `'   '`, a response with `choices: []`, and a non-JSON 200 body; each asserts `'empty completion'`.
9. **`it('clamps a model id longer than the 64-character column')`** — response `model` of 90 characters; assert `strlen($result->model) === 64` and no `…` suffix.
10. **`it('returns the content when finish_reason is length')`** — Decision 9.
11. **`it('defaults token counts to zero when usage is absent')`**.

### B — `api/tests/Feature/Ai/AssistProviderBindingTest.php` (new)

Resolves `AssistGenerator` from the container after a runtime `config([...])`. No `RefreshDatabase`. **The binding is a `bind`, so each `app(AssistGenerator::class)` re-runs the closure** — no `forgetInstance` needed, but do not call `bindAssistGenerator()` in this file or the fake will mask what is under test.

1. **`it('binds the anthropic generator when the provider is anthropic')`** — `config(['ai.enabled' => true, 'ai.provider' => 'anthropic'])`; assert `app(AssistGenerator::class)` is an `AnthropicAssistGenerator`.
2. **`it('binds one OpenAI-compatible generator for groq and for gemini')`** — a dataset over `['groq', 'gemini']`, each setting `ai.provider` and the matching `ai.providers.<name>.key`; assert the resolved instance is `OpenAiCompatibleAssistGenerator` in both cases. **This is Done Criterion 3 as a test.**
3. **`it('binds the unavailable generator when the selected provider has no key')`** — `ai.enabled => false`; assert `UnavailableAssistGenerator`.
4. **`it('binds the unavailable generator for an unknown provider name')`** — `ai.enabled => true`, `ai.provider => 'not-a-provider'`; assert `UnavailableAssistGenerator` and that resolving it **does not throw**.
5. **`it('registers three providers, each with a key, model and base url slot')`** — assert `array_keys(config('ai.providers'))` is `['anthropic', 'groq', 'gemini']` and every entry has the three keys. Guards against a later edit half-adding a provider.

### C — `api/tests/Feature/Ai/AiSmokeCommandTest.php` (new)

`uses(RefreshDatabase::class)` — it needs a ticket.

1. **`it('fails cleanly when AI assist is disabled')`** — `config(['ai.enabled' => false])`; `$this->artisan('ai:smoke')->assertExitCode(1)`.
2. **`it('prints the generated content for the newest ticket with messages')`** — create a ticket with two messages, `bindAssistGenerator('Smoke output.')`, `config(['ai.enabled' => true])`; assert exit code `0` and `expectsOutputToContain('Smoke output.')`.
3. **`it('reports a provider failure as a non-zero exit')`** — `bindFailingAssistGenerator()`; assert exit code `1`. **This is Done Criterion 4 at the console layer** — the command must not let the exception escape.

### D — Regression (no new file)

4. The nine files in Context item 9 run **unchanged and green**. That is Done Criterion 5's first clause, and it is the check that the `config/ai.php` restructure did not move a key someone reads.
5. `api/tests/Unit/AssistTranscriptTest.php` runs unchanged — it reads `ai.transcript_messages` / `ai.transcript_chars`, which Task 1 deliberately leaves in place.

---

## Migration / Rollback

**No database migration.** The rollback surface is configuration only.

- **To roll back to today's behaviour without reverting code:** set `AI_PROVIDER=anthropic` in `api/.env` and run `php artisan config:clear`. The binding returns `AnthropicAssistGenerator`, `ai.key`/`ai.model` resolve to the Anthropic entry, and every code path is byte-identical to pre-WIS-26. Verify with `php artisan ai:smoke` (it prints the generator class).
- **To turn the feature off entirely:** `AI_ASSIST_ENABLED=false`, or unset every provider key. Both cards vanish; the Conversation Thread returns to its Story 05 behaviour, exactly as Story 19's rollback describes.
- **Half-applied state to watch for:** a production box running `config:cache`. Deploying the new `config/ai.php` **without** re-running `php artisan config:cache` leaves the old cached array in place — `ai.provider` and `ai.providers` are then `null`, `config('ai.enabled')` keeps its cached value, and the binding's `match` falls to `default` and returns `UnavailableAssistGenerator`. That degrades to "no cards", not a crash, but the deploy step **must** re-cache. Note it in the deploy checklist if one exists.
- **Reverting the code** leaves no orphaned rows: `ai_assist_artifacts` rows written by a Groq/Gemini run remain readable — `model` is a free-text column and `AiAssistArtifactResource` does not validate it.

---

## Verification Steps

1. **Backend suite (all of it):** `cd api && php artisan test`. Expect the pre-story count **plus the new tests from files A, B and C**, all green. The pre-story baseline as of WIS-25 is 510 passing / 2,563 assertions on local PostgreSQL (`api/phpunit.xml:53–58`).
2. **Backend suite (the AI slice only, fast loop):** `cd api && php artisan test --filter=Assist` and `cd api && php artisan test tests/Feature/Ai`.
3. **Style:** `cd api && ./vendor/bin/pint --test app/Services/Ai app/Providers/AppServiceProvider.php app/Console/Commands/AiSmokeCommand.php config/ai.php tests/Feature/Ai`. Repo-wide `pint --test` is **already dirty on ~30 pre-existing files** (recorded in `.squad/pipeline.md`'s WIS-25 run log) — scope the check to touched paths, and do not reformat files this story does not own.
4. **Config integrity:** `cd api && php artisan config:clear && php artisan config:cache && php artisan config:clear`. Must exit 0 — this is the check that `config/ai.php` never throws (Decision 4).
5. **Regression — the unknown-provider path:** `cd api && AI_PROVIDER=nonsense php artisan tinker --execute="dump(config('ai.enabled'), get_class(app(App\Services\Ai\AssistGenerator::class)));"` → `false` and `App\Services\Ai\UnavailableAssistGenerator`. (On Windows PowerShell: `$env:AI_PROVIDER='nonsense'; php artisan tinker --execute="…"`.)
6. **Regression — the disabled path (no key at all):** with every provider key empty, `php artisan serve` + open a ticket in the SPA. Neither card renders; the composer, KB picker, quick-reply picker and internal-note tabs behave exactly as before.
7. **Frontend untouched:** `cd web && npm run test && npm run lint && npm run build`. Nothing under `web/` is edited, so all three must match the pre-story result exactly (570 passing as of WIS-25). `git diff --name-only` must show **zero** files under `web/`.
8. **Owner step, once a free key exists** (this is how Done Criteria 1 and 2 get ticked): paste `GROQ_API_KEY` (or `GEMINI_API_KEY`) into `api/.env`, set `AI_PROVIDER` to match, then:
   ```bash
   cd api && php artisan config:clear
   php artisan ai:smoke --kind=summary
   php artisan ai:smoke --kind=reply
   ```
   Both must exit 0 and print real prose. Then open a ticket in the SPA and confirm the summary card auto-generates on mount and the "Suggest a reply" button fills the composer draft.
9. **Owner step — the failure path with a real provider:** set `GROQ_API_KEY` to a deliberately invalid value, `php artisan config:clear`, reload the ticket. The **failed** card appears with a Retry button; the response is `503`, not `500`; and a reply can still be typed and sent while that card is showing.

---

## Done Criteria

Two of these five need a key the owner supplies after the code lands. **Criteria 3, 4 and 5 are code-verifiable and must be discharged by the executor; criteria 1 and 2 are owner-verifiable** via Verification Step 8, and the executor leaves them unticked with a note saying which command discharges them.

- [ ] **With only a free key set, the summary card generates on a real ticket.** *(Owner — Verification Step 8. Executor delivers `php artisan ai:smoke --kind=summary` as the one-command proof.)*
- [ ] **Suggested reply works from the same provider.** *(Owner — Verification Step 8, `--kind=reply`.)*
- [ ] **Switching `AI_PROVIDER` swaps providers with no code change** — `api/config/ai.php` carries a three-entry `providers` map, `AppServiceProvider`'s `AssistGenerator` bind selects by `config('ai.provider')`, and `AssistProviderBindingTest` tests 1, 2 and 4 assert the resolved class for `anthropic`, `groq`, `gemini` and an unknown name.
- [ ] **Provider failure still degrades to the existing `failed` state, not a crash** — every path in `OpenAiCompatibleAssistGenerator` ends in `AssistUnavailableException` (429, 5xx, transport, refusal, empty completion, non-JSON body), the model id is clamped to 64 so `updateOrCreate` cannot throw a `QueryException`, and `AiSmokeCommandTest` test 3 proves the console layer swallows it too.
- [ ] **Existing AI tests pass against the seam with the fake generator unchanged, and each new provider path has an error-mapping test** — `api/tests/Pest.php` and the nine files in Context item 9 are untouched and green; `OpenAiCompatibleAssistGeneratorTest` covers 429, 500, transport, refusal, empty, non-JSON and over-long-model for the Groq path and asserts the Gemini base URL is used unchanged (test 3).
- [ ] **No frontend file changed** — `git diff --name-only` shows nothing under `web/`, and `npm run test` / `lint` / `build` match the pre-story result.
- [ ] **No new composer dependency** — `api/composer.json` is unchanged.
- [ ] **`.env.example` documents all three providers**, and `README.md` says how to turn AI Assist on with a free key (Task 6, three anchors: `:182`, after `:126`, `:762`).

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 23 (WIS-27).**
