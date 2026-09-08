> **Fetched from jira:** [WIS-26](https://ibrahemelahmedy.atlassian.net/browse/WIS-26)  
> *Fetched 2026-09-08T22:57:12.323Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Add a free AI provider (Gemini / Groq) behind the AssistGenerator seam  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Context

App\Services\Ai\AssistGenerator is a clean provider seam. Today the only implementation is AnthropicAssistGenerator (paid, needs ANTHROPIC_API_KEY), so on any environment without that key the summary and suggested-reply cards render nothing (if (!enabled) return null).

Goal

A no-cost provider so the AI features are visibly working in dev and in the demo, selectable by config.

Scope

	New implementation, e.g. GeminiAssistGenerator (Google AI Studio free tier) and/or GroqAssistGenerator (Llama 3.x, generous free tier). Both expose an OpenAI-compatible endpoint, so one OpenAiCompatibleAssistGenerator with a base-URL + model config may cover both.

	config/ai.php: provider = anthropic | gemini | groq; enabled true when the selected provider's key is present.

	AppServiceProvider binds the implementation by provider.

	Map provider errors/refusals to AssistUnavailableException exactly as the Anthropic one does.

	Docs: .env.example keys + a line in the README AI section.

Done criteria

	[ ] With only a free key set, the summary card generates on a real ticket.

	[ ] Suggested reply works from the same provider.

	[ ] Switching AI_PROVIDER swaps providers with no code change.

	[ ] Provider failure still degrades to the existing failed state, not a crash.

	[ ] Existing AI tests pass against the seam (fake generator unchanged); one test per new provider's error mapping.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ai-provider-seam/WIS-26/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Free AI Provider Behind the AssistGenerator Seam (Gemini / Groq)
- **Feature slug (folder under `plans/`):** `ai-provider-seam`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-26` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Add a free AI provider (Gemini / Groq) behind the AssistGenerator seam
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Context

App\Services\Ai\AssistGenerator is a clean provider seam. Today the only implementation is AnthropicAssistGenerator (paid, needs ANTHROPIC_API_KEY), so on any environment without that key the summary and suggested-reply cards render nothing (if (!enabled) return null).

Goal

A no-cost provider so the AI features are visibly working in dev and in the demo, selectable by config.

Scope

	New implementation, e.g. GeminiAssistGenerator (Google AI Studio free tier) and/or GroqAssistGenerator (Llama 3.x, generous free tier). Both expose an OpenAI-compatible endpoint, so one OpenAiCompatibleAssistGenerator with a base-URL + model config may cover both.

	config/ai.php: provider = anthropic | gemini | groq; enabled true when the selected provider's key is present.

	AppServiceProvider binds the implementation by provider.

	Map provider errors/refusals to AssistUnavailableException exactly as the Anthropic one does.

	Docs: .env.example keys + a line in the README AI section.

Done criteria

	[ ] With only a free key set, the summary card generates on a real ticket.

	[ ] Suggested reply works from the same provider.

	[ ] Switching AI_PROVIDER swaps providers with no code change.

	[ ] Provider failure still degrades to the existing failed state, not a crash.

	[ ] Existing AI tests pass against the seam (fake generator unchanged); one test per new provider's error mapping.
```

---

## Acceptance criteria

*(Copied verbatim from the Jira issue's "Done criteria" block. These five are the story's Done Criteria.)*

```
[ ] With only a free key set, the summary card generates on a real ticket.
[ ] Suggested reply works from the same provider.
[ ] Switching AI_PROVIDER swaps providers with no code change.
[ ] Provider failure still degrades to the existing `failed` state, not a crash.
[ ] Existing AI tests pass against the seam (fake generator unchanged); one test per new provider's error mapping.
```

Note for the planner: criteria 1 and 2 need a real free API key, which the owner supplies
**after** the code lands. Everything else must be discharged without a key, by test. The plan must
say explicitly which criteria are code-verifiable and which are owner-verifiable, and must ship a
`php artisan ai:smoke` style manual verification recipe (or an equivalent tinker one-liner) so the
owner can tick 1 and 2 in one command once the key is pasted.

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| — | — |

None. Every fact this story needs is in the repository or in the two providers' public
OpenAI-compatibility docs; the file paths are listed under **Technical hints** below.

---

## Dependencies

- **Blocked by / related ids:** none. The owner supplies a Groq and/or Google AI Studio key
  **after** the code lands; the story is built and tested against a faked HTTP layer
  (`Http::fake()`), so no key is needed to complete it.
- **Blocks:** **WIS-23** (AI auto-classify + chatbot). WIS-23 needs a working, no-cost generator to
  call per inbound ticket; that is the reason WIS-26 sits second in the `.squad/pipeline.md` order.
  WIS-23 will most likely need a **structured/JSON** response from the same provider — do not paint
  that into a corner, but do not build it here either (see **Out of scope**).
- **Depends on code areas or other stories:**
  - **Story 19 — ai-assist-panel (WIS-18)**, `.squad/plans/ai-assist-panel/19-story-ai-assist-panel.md`.
    Owns the entire seam this story extends: `App\Services\Ai\AssistGenerator` (the interface),
    `AssistResult`, `AnthropicAssistGenerator`, `UnavailableAssistGenerator`, `AssistTranscript`,
    `TicketAssist`, `App\Exceptions\AssistUnavailableException`, `api/config/ai.php`,
    `TicketAssistController`, the `ai_assist_artifacts` table, the `throttle:ai-assist` limiter,
    `api/lang/{en,ar}/ai.php`, and `web/src/features/ai-assist/**`. **Every one of its decisions is
    still binding.** In particular: Decision 1 (the seam), Decision 3 (a failed generate does not
    self-retry), and the `enabled`-gates-everything rule.
  - **Story 18 — integrations-erp (WIS-19)**, for `App\Services\HttpIntegrationTester`. That class
    is the in-repo precedent for an outbound HTTP call through Laravel's `Http` facade with an
    explicit timeout and a `Throwable` catch that **never** puts the provider's message (which can
    embed an `Authorization` header) into anything the caller sees. Copy that discipline.

## Extra notes (optional)

- **The frontend needs no change, and must get none.** `web/src/features/ai-assist/components/AiSummaryCard.tsx:21,35`
  and `SuggestedReplyCard.tsx` read `enabled` off `GET /api/tickets/{id}/ai-assist`, which is
  `(bool) config('ai.enabled')` at `api/app/Http/Controllers/TicketAssistController.php:30`. Making
  `enabled` true for a Groq/Gemini key is the *entire* fix for "the cards render nothing" — there is
  no provider name, no model name and no per-provider branch anywhere in `web/`. `AssistArtifact.model`
  (`web/src/features/ai-assist/model/assist.ts:4`) is typed `string` and is not rendered.
- **`ai_assist_artifacts.model` is `string(64)`** (`api/database/migrations/*_create_ai_assist_artifacts_table.php:22`).
  An OpenAI-compatible response echoes the provider's own model id, which for Groq can be longer and
  more decorated than the request's (`llama-3.3-70b-versatile`, and Gemini's compat layer answers
  `models/gemini-2.0-flash` on some paths). The generator must clamp what it puts in `AssistResult::$model`
  to 64 characters or the insert throws a `QueryException` — which is **not** an
  `AssistUnavailableException` and would surface as a 500, breaking Done Criterion 4.
- **All nine AI-touching test files set `config(['ai.enabled' => true|false])` at runtime** and bind a
  fake through `bindAssistGenerator()` / `bindFailingAssistGenerator()` (`api/tests/Pest.php:48–115`).
  None of them constructs `AnthropicAssistGenerator`, reads `ai.key`, or makes an HTTP call. Making
  `enabled` provider-derived *at config-load time* therefore cannot break them — but the planner must
  verify that claim rather than assume it, and the executor must re-run the suite.
- **`config('ai.timeout')` (30s) exists and is currently read by nobody.** `AnthropicAssistGenerator`
  never applies it. The new HTTP generator should honour it — that is what it was added for.
- **Composer holds `anthropic-ai/sdk` and nothing else AI-shaped.** There is no `openai-php/client`,
  no Guzzle wrapper of our own. `illuminate/http` (the `Http` facade over Guzzle) ships with the
  framework, so an OpenAI-compatible generator needs **zero new dependencies**. Adding an SDK for
  this would be the only new runtime dependency in the story and should have to justify itself.
- **Keys are pasted by the owner into `api/.env`, never committed.** `.env.example` gets empty keys
  and a comment, exactly like the existing `ANTHROPIC_API_KEY=` block at `api/.env.example:67–69`.
- **The README has no "AI section" with env keys in it.** The Jira line "a line in the README AI
  section" resolves to: the Category-7 row of the requirements table (`README.md:182`) and/or the
  "AI features are partial" bullet under **12. Known gaps** (`README.md:762`). The planner must pick
  the exact anchor and say so; do not invent a new top-level section.
- Groq and Google AI Studio both document an **OpenAI-compatible** `POST {base}/chat/completions`
  taking `{model, messages:[{role,content}], max_tokens, temperature}` with a
  `Authorization: Bearer <key>` header, and answering
  `{choices:[{message:{content}, finish_reason}], usage:{prompt_tokens, completion_tokens}, model}`.
  Base URLs: Groq `https://api.groq.com/openai/v1`, Gemini
  `https://generativelanguage.googleapis.com/v1beta/openai`. **These are config values, not
  constants in a class** — a wrong base URL must be fixable in `.env`.

## Technical hints (optional)

Repos/roots: `.` (`api/` Laravel 13 + `web/` React 19). Files this story touches or reads:

- `api/app/Services/Ai/AssistGenerator.php` — the interface. **One method,
  `generate(string $system, string $transcript): AssistResult`, `@throws AssistUnavailableException`.
  It is not changed by this story.**
- `api/app/Services/Ai/AnthropicAssistGenerator.php` (63 lines) — the error-mapping template to
  mirror: catch the transport/status exceptions → `AssistUnavailableException`; check refusal
  **before** reading content; treat a whitespace-only completion as `empty completion`.
- `api/app/Services/Ai/UnavailableAssistGenerator.php`, `AssistResult.php`, `AssistTranscript.php`,
  `TicketAssist.php` — unchanged, but read them: `TicketAssist::generate()` lets the exception
  propagate and `TicketAssistController::run()` (`:62–68`) turns it into `503 __('ai.failed')`.
  That is the "existing failed state" Done Criterion 4 names.
- `api/app/Exceptions/AssistUnavailableException.php` — a bare `extends \RuntimeException`.
- `api/config/ai.php` (32 lines) — the file being restructured. Today: `enabled`, `key`, `model`,
  `effort`, `max_tokens`, `timeout`, `transcript_messages`, `transcript_chars`. **`effort` is
  Anthropic-only; `transcript_*` are provider-agnostic and are read by `AssistTranscript`
  (`:67`, `:117`) — do not move or rename those two.**
- `api/app/Providers/AppServiceProvider.php:63–67` — the `Anthropic\Client` singleton and the
  `AssistGenerator` bind. **The `Client` singleton is registered unconditionally today; if the
  provider is `groq` no Anthropic key exists, and the closure must still never run.** It is lazy,
  so this is safe — confirm it, and keep it lazy.
- `api/app/Services/HttpIntegrationTester.php:52–74` — the `Http::` + `timeout()` + `catch (Throwable)`
  + "never log the exception message, it can contain the secret" pattern to copy.
- `api/tests/Pest.php:33–115` — `bindAssistGenerator()` and `bindFailingAssistGenerator()`.
  **Unchanged by this story** (Done Criterion 5 says so in as many words). Note the docblock's
  warning about a controller instance being cached on the `Route` object.
- The nine test files that touch the seam: `api/tests/Feature/Ai/AiAssist{Access,Caching,Disabled,Dismiss,Failure,NeverSends,Prompt,Throttle}Test.php`
  and `api/tests/Feature/ApiContractTest.php:346`. Plus `api/tests/Unit/AssistTranscriptTest.php`,
  which touches the prompt builder only.
- `api/app/Http/Controllers/TicketAssistController.php:30,58,62–68`.
- `api/routes/api.php:77–86` — the four routes; `throttle:ai-assist` on the two generating ones.
- `api/lang/en/ai.php` + `api/lang/ar/ai.php` — two keys, `unavailable` and `failed`. **A new
  provider needs no new key**; every provider failure is the same `ai.failed` to the user.
- `api/.env.example:67–69` — the existing AI block.
- `README.md:182` (Category 7 row) and `README.md:762` ("AI features are partial") — candidate doc
  anchors.
- `api/composer.json:8–14` — the runtime dependency list.
- `web/src/features/ai-assist/**` (10 files) — read to confirm nothing changes there.

## Out of scope

- **No change to `AssistGenerator`'s signature.** `generate(string $system, string $transcript): AssistResult`
  is frozen. A structured/JSON-mode variant is WIS-23's problem, not this story's.
- **No new frontend code, no new i18n string, no new lang key.** The provider is invisible to the
  UI by design; if the executor finds itself editing `web/`, the design is wrong.
- **No migration, no new column, no new table.** In particular, do not widen
  `ai_assist_artifacts.model` — clamp the value instead.
- **No new composer dependency** unless the plan argues one is unavoidable. `Http` + `illuminate/http`
  already ships.
- **No removal of `AnthropicAssistGenerator`** and no deletion of `anthropic-ai/sdk`. Anthropic stays
  a selectable provider and stays the default when its key is the one present.
- **No streaming, no tool use, no retries/backoff, no response caching beyond the existing
  `ai_assist_artifacts` row.** One request, one answer, one failure mode.
- **No cost/usage dashboard, no per-provider token accounting surface.** `input_tokens` /
  `output_tokens` continue to be stored as today, and nothing new reads them.
- **No live-key verification in CI.** Every test in this story runs against `Http::fake()`.
- **Not WIS-23.** No auto-classification, no chatbot, no per-ticket background generation.
