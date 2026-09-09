# ai-customer-intelligence — plan overview

Entry point for the **ai-customer-intelligence** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 24 | [24-story-ai-customer-intelligence.md](24-story-ai-customer-intelligence.md) | AI Auto-Classification & Customer Chatbot (Category 7 completion) | WIS-23 | Stories 19, 22, 04, 09, 17, 23 |

## Dependency notes

**This is the story that finishes Category 7.** WIS-18 (Story 19) shipped ticket summary and
suggested reply; WIS-26 (Story 22) made them run on a free key. This story adds the two features
both of them deliberately left out. Planned at **full** depth: every path, line range and signature
was verified against real code at plan time.

- **Depends on** [`../ai-assist-panel/19-story-ai-assist-panel.md`](../ai-assist-panel/19-story-ai-assist-panel.md)
  — the seam itself (`AssistGenerator`, `AssistResult`, `AssistTranscript`, `TicketAssist`,
  `AssistUnavailableException`, `config/ai.php`, `ai_assist_artifacts`, `throttle:ai-assist`).
- **Depends on** [`../ai-provider-seam/22-story-ai-provider-seam.md`](../ai-provider-seam/22-story-ai-provider-seam.md)
  — and **discharges its recorded deferral**: *"Structured / JSON-mode output. WIS-23's
  auto-classification wants a schema-constrained answer. `AssistGenerator::generate()`'s signature
  is frozen here; WIS-23 either adds a second method or a second interface."* Story 24 chooses
  **neither**: structure is demanded by the system prompt and parsed defensively out of the text
  (Decision 1), so a JSON mode that only two of three providers support never enters the contract.
- **Depends on** [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md)
  for `tickets`, `Ticket::CATEGORIES`, both creation paths, and `ticket_events` — **the single
  append-only ticket-history table**, which this story reads and does not extend.
- **Depends on** [`../knowledge-base/09-story-knowledge-base.md`](../knowledge-base/09-story-knowledge-base.md)
  for the `ArticleSearch` contract and its two engines. Chatbot grounding reuses the interface and
  writes no second ranking query.
- **Depends on** [`../customer-portal/17-story-customer-portal.md`](../customer-portal/17-story-customer-portal.md)
  for the portal identity. **ADR-005 is binding**: the chatbot is a `portal`-middleware surface and
  can never be reached with `auth:sanctum`.
- **Depends on** [`../transactional-email/23-story-transactional-email.md`](../transactional-email/23-story-transactional-email.md)
  for the in-repo `DB::afterCommit` + per-process-cap + `catch (Throwable)` observer pattern
  (`TicketResolutionObserver.php:104-138`) and the `TestCase::setUp()` counter reset.
- **Blocks nothing.** It is a leaf.

**Contracts this story establishes**, which a later story consumes rather than redefines:

- **The AI classification lives on the `tickets` row**, in six nullable columns
  (`ai_suggested_category`, `ai_suggested_priority`, `ai_confidence`, `ai_classified_at`,
  `ai_classification_model`) plus `needs_triage`. Not in `ai_assist_artifacts`, which is
  thread-summary shaped and unqueryable for a queue filter.
- **`ai_classified_at IS NULL` means "never classified"** — a provider failure or the feature being
  off. That is a *different* state from "classified and found ambiguous", which is
  `ai_classified_at` set with both suggestions null and `needs_triage` true. Any later feature that
  re-classifies must preserve the distinction.
- **No server-side path ever writes `tickets.category` or `tickets.priority` from a model output.**
  Applying a suggestion is `PATCH /api/tickets/{id}` performed by a human, which is what makes it
  land in `ticket_events`. There is deliberately no apply endpoint.
- **`App\Services\Ai\JsonAnswer::parse()` is the one place model text becomes an array.** It never
  throws; `null` is the caller's signal for low confidence (classify) or unavailable (chat).
- **Chatbot grounding is published-KB-only**, via
  `where('status', 'published')->whereNotNull('published_at')` composed with
  `ArticleSearch::apply()` — the same pair `PortalFaqController::index()` uses.
  `KbArticle::scopeVisibleTo()` is the **staff** boundary and is forbidden on this path.
- **Model-supplied citation slugs are never trusted**; they are intersected with the slugs actually
  offered in the CONTEXT block.
- **`config('ai.chat.*')` and `config('ai.classify.*')` are where every guardrail number lives.**
  No magic numbers in a service or a controller.
- **`App\Enums\ChatReplyState`** (`ok | refused | unavailable | ended | rate_limited`) is the one
  vocabulary the chat SPA renders. `rate_limited` is produced by the SPA from an HTTP 429; the other
  four arrive in a **200** body.

## Deliberate deferrals

Recorded here so a later story picks them up instead of this one growing:

- **`kb_articles.locale`.** The table has no locale column, so grounding cannot be filtered by
  language; only the answer language is steered, from the system prompt. Per-locale article
  variants are a Knowledge Base story, not this one.
- **Semantic / vector retrieval.** Grounding is lexical, through the existing `ArticleSearch`
  (`ts_rank` on PostgreSQL, a ranked `LIKE` on SQLite). Embeddings need a dependency and a store
  this repo does not have.
- **A per-call timeout.** `config('ai.chat.timeout')` is declared and documented as **not yet
  applied**: `OpenAiCompatibleAssistGenerator` reads `config('ai.timeout')` and owns the HTTP
  budget, and giving one call a different budget needs the seam change Decision 1 rejects.
- **Re-classification of existing tickets.** No sweep command, no re-run on update. Every ticket
  created before this story ships reads as "never classified".
- **A `needs_triage` chip in the agent queue's FilterBar.** The backend filter
  (`?needs_triage=1`) and the `scopeNeedsTriage()` scope ship here; the URL-state filter chip does
  not, to keep the frontend surface focused on the two Done Criteria that need it.
- **A customer-keyed chat budget.** The per-day limiter is keyed on the portal bearer token, so
  signing out and back in resets it. A customer-keyed limiter needs a `Customer` lookup inside the
  limiter closure; recorded as a known limitation in the plan's Edge Cases.
- **Token accounting as a reportable surface.** Conversation token counters are stored and enforced;
  nothing reports them. A usage dashboard belongs with Reports.
