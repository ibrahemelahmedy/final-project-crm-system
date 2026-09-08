# ai-provider-seam — plan overview

Entry point for the **ai-provider-seam** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 22 | [22-story-ai-provider-seam.md](22-story-ai-provider-seam.md) | Free AI Provider Behind the AssistGenerator Seam (Gemini / Groq) | WIS-26 | Stories 19, 18 |

## Dependency notes

**This is a provider story, not a feature story.** It adds no migration, no endpoint, no resource key
and no frontend module. It makes the AI Assist cards from Story 19 work on a free API key, chosen by
one `.env` line. Planned at **full** depth: every path, line range and signature was verified against
real code at plan time.

- **Depends on** [`../ai-assist-panel/19-story-ai-assist-panel.md`](../ai-assist-panel/19-story-ai-assist-panel.md).
  Story 19 built the seam (`AssistGenerator`, `AssistResult`, `AssistUnavailableException`,
  `config/ai.php`, the `AppServiceProvider` bind, `TicketAssistController`'s 503 mapping, both SPA
  cards). **Every Story 19 decision still holds** — this story adds an implementation behind the
  interface and changes nothing about how the interface is consumed.
- **Depends on** [`../integrations-erp/18-story-integrations-erp-admin.md`](../integrations-erp/18-story-integrations-erp-admin.md)
  for the house pattern of an outbound HTTP call: `App\Services\HttpIntegrationTester:52–74` —
  `Http::` with an explicit `timeout()`/`connectTimeout()`, a `catch (Throwable)`, and the rule that
  a provider's or Guzzle's own message is **never** stored or returned, because it can embed the
  `Authorization` header.
- **Blocks WIS-23** (AI auto-classify + chatbot), which needs a no-cost generator to call per inbound
  ticket. WIS-23 will want a *structured/JSON* answer; this story deliberately does not build one.

**Contracts this story establishes**, which a later story consumes rather than redefines:

- **`config('ai.providers')` is the provider registry** — a map of `anthropic|groq|gemini` to
  `{key, model, base_url}`. `config('ai.provider')` names the live entry; `config('ai.enabled')` is
  true only when **that** entry's key is present. A fourth provider is a new map entry, not a new
  config file. `ai.key` and `ai.model` remain top-level and resolve to the selected entry — that is
  what keeps `AnthropicAssistGenerator` and the `Anthropic\Client` singleton unedited.
- **`App\Services\Ai\OpenAiCompatibleAssistGenerator` is the one class for every OpenAI-compatible
  provider.** Base URL, model, key and a provider label are constructor arguments. Adding a third
  OpenAI-compatible provider must not add a class.
- **Every failure is `AssistUnavailableException`, with a constructed message.** Transport, 4xx/5xx,
  content-filter refusal, empty completion. The message is built from the provider name and the HTTP
  status — never forwarded from the provider or from Guzzle.
- **`AssistResult::$model` is clamped to 64 characters**, because `ai_assist_artifacts.model` is
  `string(64)` and an over-long value would be a `QueryException`, i.e. a 500 rather than the
  `failed` card.
- **`php artisan ai:smoke` is the one-command provider check.** It resolves `AssistGenerator` from
  the container, so it proves the binding, not a hand-built object.

## Deliberate deferrals

Recorded here so a later story picks them up instead of this one growing:

- **Structured / JSON-mode output.** WIS-23's auto-classification wants a schema-constrained answer.
  `AssistGenerator::generate()`'s signature is frozen here; WIS-23 either adds a second method or a
  second interface.
- **Retry and backoff on a free-tier 429.** Deliberately absent (Decision 8) — the SPA already has a
  Retry button and the call is synchronous inside a 30-second budget. Moving generation to a queued
  job is the change that would make retries sensible.
- **Per-provider cost/usage reporting.** `input_tokens` / `output_tokens` are stored as before and
  nothing reads them. A usage surface belongs with Reports, not here.
- **A live-key smoke test in CI.** Every test here runs under `Http::fake()`. Wiring a real key into
  CI is an infrastructure decision the owner has not made.
