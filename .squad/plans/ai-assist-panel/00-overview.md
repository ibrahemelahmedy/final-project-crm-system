# ai-assist-panel — plan overview

Entry point for the **ai-assist-panel** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 19 | [19-story-ai-assist-panel.md](19-story-ai-assist-panel.md) | AI Assist — Ticket Summary & Suggested Reply | WIS-18 | 04 tickets · 05 thread · 10 productivity (`publicOnly`) · 15 i18n · **coordinate with** 16 i18n-retrofit (WIS-17) |

**Numbering note.** This story was drafted as `18`; `integrations-erp` (WIS-19) claimed that number
in a parallel planning session and `.squad/plans/00-index.md`'s dependency spine already records it.
`naming.globalSequence` is `true`, so this moved to `19` — the same collision that moved
`customer-portal` from `16` to `17`. Nothing was overwritten.

## Dependency notes

This is the first story in the product to make an outbound **paid** API call, and the first to put
generated text in front of an agent. Both facts drive its structure more than its size does.

**Sequencing.** It fills the slot Story 05 reserved and left empty on purpose
(`web/src/features/tickets/components/thread/ReplyComposer.tsx:184–189` — *"AI-suggested reply … is
NOT built in this story"*). It cannot be pulled earlier: the composer's caret-insert seam, the
metadata panel's slot pattern, `TicketMessage::scopePublicOnly()`, and the i18n machine all have to
exist first. It is otherwise a leaf — no later story depends on it.

**Coordinate with WIS-17** ([`../i18n-retrofit/16-story-i18n-retrofit.md`](../i18n-retrofit/16-story-i18n-retrofit.md)).
**That story is in flight and uncommitted in the working tree**, so this plan's read of it is a
snapshot: `web/src/i18n/locales/{en,ar}/conversation.json` is already **populated** (eleven top-level
groups) and 10 of the 20 files in `components/thread/` are already on `useT`. This story adds a new
`assist` group beside them — no collision today, but the executor must re-check, and must re-locate
the anchors in `ReplyComposer.tsx` / `TicketMetaPanel.tsx` **by symbol** if WIS-17 migrates those two
first (neither is migrated yet, so the plan's line numbers are accurate as written). This story
deliberately does **not** add `src/features/tickets` to `web/scripts/i18n-allowlist.json`'s `roots` —
that is WIS-17's deliverable.

## Planning decisions recorded in the story

The intake defers model choice, prompt design, and cost/rate-limit handling to planning. All six
decisions are settled in the story file; these are the ones worth knowing before reading it.

- **Decision 1 — Anthropic Messages API via the official PHP SDK (`anthropic-ai/sdk`), model
  `claude-opus-5`, adaptive thinking at `effort: 'low'`.** No provider-neutral layer: the seam is
  `App\Services\Ai\AssistGenerator`, which is where a second provider would go.
- **⚠️ Decision 2 is the load-bearing one.** The **suggested-reply prompt sees only `publicOnly()`
  messages; the summary sees all of them.** The summary is agent-only and the design's own copy
  summarises an internal note, so it gets the full thread. The reply is a draft headed for a
  customer, so it is built from the customer-visible transcript alone — enforced *in the query*,
  the same rule Stories 05, 10 and 17 already apply. An internal note cannot be paraphrased into a
  customer reply even if the model is asked to.
- **Decision 3 — the summary auto-generates on first view; the suggested reply is agent-initiated.**
  Taken from the artboards, which show a populated summary beside an idle `Suggest a reply` button.
  It also bounds cost.
- **Decision 4 — generation is synchronous, not queued.** A queue would need a polling endpoint and
  a durable job table on a serverless deployment; the 30s budget fits behind the skeleton the
  GENERATING artboard already depicts.
- **Decision 5 — artefacts are persisted per `(ticket_id, kind)` and reused.** Re-opening a ticket
  must not re-bill. Staleness is the design's relative timestamp only; there is no stale badge,
  because the design has none.
- **Decision 6 — the `AI` chip stays Latin in Arabic**, resolving the open question the intake
  raised. The RTL artboard renders it untranslated and `ذكاء اصطناعي` triples the pill's width.

## Contracts owned here

See the story's Backend Tasks for full definitions.

- Table **`ai_assist_artifacts`** and enum **`AssistKind`** (`summary` | `suggested_reply`) — one
  row per pair, unique-indexed, replaced on regenerate. It holds no ticket state; **no AI text ever
  becomes a `ticket_messages` row**, which is what the no-auto-send constraint reduces to.
- Four routes under **`/api/tickets/{ticket}/ai-assist`** (`GET`, `POST .../summary`,
  `POST .../reply`, `DELETE .../reply`), all gated by `TicketPolicy@view`.
- The named limiter **`ai-assist`** — the only paid-per-call limiter in the app, keyed on the user
  rather than the IP so one agent's regenerate loop cannot lock out a shared office.
- `config/ai.php` and the **`AI_ASSIST_ENABLED` kill switch** — with no key configured the feature
  is off, both cards render `null`, and the Conversation Thread is byte-identical to Story 05.
- The seam **`App\Services\Ai\AssistGenerator`** with `AnthropicAssistGenerator` and
  `UnavailableAssistGenerator`, bound in `AppServiceProvider` beside `PortalCodeNotifier` and
  `ArticleSearch`.
- Frontend module `web/src/features/ai-assist/` and the **`conversation:assist.*`** i18next keys.

## What it reads but does not own

`tickets` and `TicketPolicy` (Story 04); `ticket_messages` and `TicketMessage::scopePublicOnly()`
(Stories 05 and 10 — the enforcement point Decision 2 depends on); `SetLocale` and the
`conversation` namespace (Story 15); `ReplyComposer`'s `insertAtCaret` seam and `TicketMetaPanel`'s
slot pattern (Story 05, with Story 13's `TicketCsatPanel` as the worked precedent).

## Cross-story edits

Three, all additive and all optional-prop shaped, so no existing mount site changes behaviour:

- `ReplyComposer` gains `assistSlot?: React.ReactNode`, rendered into the empty
  `.thread-assist-slot` node Story 05 reserved for it.
- `TicketMetaPanel` gains `topSlot?: ReactNode`, rendered above `TICKET DETAILS` — `extraSlot` keeps
  its position, so Story 13's CSAT panel does not move.
- `web/src/features/tickets/index.ts` exports `ticketKeys`, so the assist query nests under
  `ticketKeys.all` and every ticket mutation already invalidates it.

## Known gaps carried deliberately

- **No streaming.** The card goes skeleton → complete. Token-by-token rendering is not in any
  artboard and would complicate the failure path that must never block the composer.
- **Cached artefacts are not regenerated on a locale change.** An agent who switches to Arabic sees
  the English summary until they press regenerate — auto-regenerating would silently double the bill
  on every language toggle.
- **The three sibling Category 7 bullets stay out of scope**: automatic categorization, suggested
  solutions from the Knowledge Base, and an AI chatbot. Each is a different surface and, per the
  intake, its own story if pursued.
