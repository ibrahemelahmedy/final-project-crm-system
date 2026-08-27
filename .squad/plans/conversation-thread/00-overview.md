# conversation-thread — plan overview

Entry point for the **conversation-thread** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 05 | [05-story-conversation-thread.md](05-story-conversation-thread.md) | Conversation Thread (Ticket Detail) | WIS-3 | Story 04 (ticket-management), Story 03 (customer-management) |

## Dependency notes

**This is the screen an agent spends most of their time in** (`docs/design/brief.md` line 153), and it
is the only place `ticket_messages` is created. Three later stories attach to what it establishes.

- **Depends on** [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md).
  Story 04's **`## Shared contracts this story establishes`** section is cited verbatim and never
  redefined: the `Priority` / `TicketStatus` / `Channel` enums, the final `tickets` columns, the
  append-only **`ticket_events`** table, the `TicketResource` shape with its fixed `sla` block, the
  `/api/tickets/*` surface, and the `ticketKeys` scheme. Story 05 **adds no column to `tickets`**,
  **creates no second history table**, and **writes nothing to Story 01's `audit_logs`**. It appends
  one new `ticket_events` value (**`replied`**) and makes two additive edits to Story 04 files: the
  opening message inside `TicketController::store()`, and a `transitions` key on
  `GET /api/tickets/meta`.
  Story 04 line **1156** explicitly defers the `/tickets/{id}` route and the row link to this story.
- **Depends on** [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md).
  **`customers.last_contact_at` is declared and seeded by Story 03 and written at runtime only by
  this story** (Story 03 contract row 157, migration comment line 346). The side panel's contact
  card reads `GET /api/customers/{customer}` because `TicketResource.customer` is `{id, name}` only
  and is frozen. `web/src/features/customers/index.ts` gains two **additive** exports
  (`useCustomer`, `customerKeys`); no file inside that feature is edited.
- **Depends on** Stories 01 and 02, both implemented and committed — the Axios instance, the single
  `QueryClient`, `RequireAuth`, and the shell whose `--header-height` and `.shell-main` padding the
  thread's height calculation reads.

### Shared contracts this story establishes

Recorded in full in the story file's **"Shared contracts this story establishes"** section, which
later plans cite verbatim rather than redefining:

- **`ticket_messages`** — the message timeline: `id · ticket_id · author_type · user_id ·
  customer_id · channel · body · timestamps`, indexed `(ticket_id, id)` and
  `(ticket_id, created_at)`. Model `App\Models\TicketMessage`, resource `TicketMessageResource`,
  controller `TicketMessageController`. **`author_type` is a closed three-value string
  (`customer` | `agent` | `system`), deliberately not an enum.**
- **`TicketMessageResource` JSON shape** — `id · ticket_id · author_type · author · is_mine ·
  channel · channel_label · body · created_at`. **`author` never carries email, phone or role.**
  Collections use Laravel's **cursor** envelope: `meta` has `next_cursor` / `prev_cursor` and
  **no `total`, no `last_page`**.
- **API** `GET|POST /api/tickets/{ticket}/messages` — cursor-paginated at a **fixed 30**,
  `?cursor=` only, `POST` body is `{ body }` and nothing else. Plus one **additive** key,
  `transitions`, on `GET /api/tickets/meta`.
- **`customers.last_contact_at`** — this story is the sole runtime writer, in one transaction,
  and it **never moves the value backwards**.
- **Frontend:** the thread ships inside `web/src/features/tickets/` (see the Product-rules row —
  there is **no** `features/conversation-thread/` folder); `ticketKeys.messages(id)` nests under
  `ticketKeys.all`; and **`ReplyComposerProps` is the frozen mount contract** —
  `onInsertAtCaret` for Story 09's `ArticlePickerPanel` and `toolbarSlot` for Story 10.

### Reserved for later stories — not implemented here

- **SLA computation** and `first_response_due_at` / `resolution_due_at` →
  [`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md).
  This story ships the panel's SLA card with **all four `sla.risk` branches** and renders the
  `null` branch ("Not configured") until Story 06 lands.
- **`ticket_messages.visibility`, internal notes, quick replies, tasks and @mentions** →
  [`../agent-productivity/10-story-agent-productivity.md`](../agent-productivity/10-story-agent-productivity.md).
  Story 10 adds the column in **its own** migration and mounts into `toolbarSlot`; it does not
  create the table and does not restructure the composer.
- **The article-reference format `[<title>](/knowledge-base/<slug>)` and `ArticlePickerPanel`** →
  [`../knowledge-base/09-story-knowledge-base.md`](../knowledge-base/09-story-knowledge-base.md).
  Story 05 implements `onInsertAtCaret` and mounts the panel; **it does not define the format.**
- **The post-resolution CSAT survey and `TicketCsatPanel`** →
  [`../csat-collection/13-story-csat-collection.md`](../csat-collection/13-story-csat-collection.md).
  Story 13 writes `ticket_messages` rows with `author_type = 'system'`, which is reserved here.
- **Real channel-provider send/receive** and **WebSocket delivery** — out of scope per the intake.
  `ticket_messages.channel` is written from the ticket's own channel; the composer's channel
  control is a **read-only indicator**, not a picker.

### Deliberate omission — the AI-suggested reply

The design artboard (`docs/design/references/3.Conversation Thread/WisalConversationThread-LightLTR.dc.html`
**lines 120–125**) shows an AI suggestion chip with **Use** / **Dismiss**, and `docs/design/brief.md`
line 158 asks for AI-assist inline near the composer. **The intake defers AI, so this story renders
the affordance not at all** — `<div className="thread-assist-slot" />` returns `null`. There is no
pill, no disabled button, and no "Coming soon" label. The brief's placement requirement is met
structurally by the slot's position; a future AI story fills that node and moves no other element.
This is a sharper line than Story 04 drew for the inert attachment drop zone, and deliberately so:
a suggested reply the product cannot generate would be a claim about provenance, not a stub.
