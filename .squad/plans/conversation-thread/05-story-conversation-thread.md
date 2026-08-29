# Story 05 — Conversation Thread (Ticket Detail) (Story: WIS-3)

## Prerequisites

- **Story 04 completed** — [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md). **Read its `## Shared contracts this story establishes` section (line 1463 onwards) before writing a line of code.** This story consumes, and never redefines:
  - The enums `Priority`, `TicketStatus`, `Channel` in `api/app/Enums/`. **`TicketStatus::allowedTransitions()` stays the single transition authority.**
  - The final `tickets` columns. **This story adds no column to `tickets`.**
  - **`ticket_events`** — the one append-only ticket-history table (`api/app/Models/TicketEvent.php`). This story **appends one new `event` value** to it and **creates no second history table**. It writes **nothing** into Story 01's `audit_logs`.
  - The `TicketResource` JSON shape, including the fixed four-key `sla` block. **Do not add a key to it.**
  - `GET /api/tickets/{ticket}`, `PATCH /api/tickets/{ticket}`, `GET /api/tickets/{ticket}/events`, `GET /api/tickets/meta` — all already exist. This story adds **two** routes and **one additive key** to `meta`'s payload.
  - `ticketKeys` in `web/src/features/tickets/api/queryKeys.ts`. **Every query this story adds nests under `ticketKeys.all`; every mutation invalidates that root.**
  - The components `PriorityBadge`, `StatusBadge`, `SlaCell`, `ChannelIcon` and the tokens `--prio-*`, `--status-*`, `--sla-*`, `--skeleton-*`. **Reused, not re-authored.**
- **Story 03 completed** — [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md).
  - **`customers.last_contact_at` is a nullable timestamp that Story 03 declares and seeds but never writes at runtime — this story owns that write** (contract row at line 157 of that plan, and the migration comment at line 346: *"written by the Conversation Thread story"*).
  - `web/src/features/customers/index.ts` currently exports `CustomersPage`, `CustomerProfilePage`, the `Customer` type and `useCustomerSearch`. This story adds **two** export lines (`useCustomer`, `customerKeys`) — see Frontend Task 3.
  - `web/src/components/ui/Modal.tsx` and `ConfirmDialog.tsx` (Story 03 Frontend structure, plan lines 845–847) are reused for the reassign and status-change controls. **Do not build a second modal primitive.**
- **Story 01 and Story 02 are implemented and committed.** `web/src/lib/api.ts` is the only Axios instance; `web/src/lib/queryClient.ts` is the only `QueryClient` (`staleTime` 30 000 ms, `mutations.retry` false — **do not relax either**).
- **Coordination with Story 09 (Knowledge Base)** — [`../knowledge-base/09-story-knowledge-base.md`](../knowledge-base/09-story-knowledge-base.md) lines 149–153 and 196–197. Story 09 owns **`ArticlePickerPanel`** and the article-reference format `[<title>](/knowledge-base/<slug>)`. **This story mounts a slot for it and defines the callback contract; it does not build the panel and does not define the reference format.** See Frontend Task 7.
- **Coordination with Story 10 (Agent Productivity)** — [`../agent-productivity/10-story-agent-productivity.md`](../agent-productivity/10-story-agent-productivity.md) lines 19–22 and 130–132. Story 10 adds a **`visibility`** column to `ticket_messages` **in its own migration**, adds an internal-note composer mode, and mounts `QuickReplyPicker`. **This story does not ship `visibility`, internal notes, quick replies, tasks, or @mentions.**
- **Coordination with Story 13 (CSAT)** — [`../csat-collection/13-story-csat-collection.md`](../csat-collection/13-story-csat-collection.md) lines 20–21 and 201. Story 13 attaches the post-resolution survey to this thread and supplies `TicketCsatPanel` for the side panel. **This story ships neither.**

---

## Story Goal

Give an agent the screen they live in: open `/tickets/{id}` and see **one continuous chronological list of every message on that ticket**, whatever channel each one was logged from, next to a **side panel that never scrolls away** and a **reply composer that never loses what was typed**.

User-visible outcomes:

1. A queue row's subject links to `/tickets/{id}`; the detail screen loads with a skeleton, never a blank frame.
2. Every message renders in one list ordered oldest → newest, each carrying its author, its **channel-of-origin** and its timestamp. **Nothing is grouped, tabbed, or filtered by channel.**
3. The newest page of messages loads first; **"Load earlier messages"** fetches older ones by cursor without refetching the whole history and without jumping the scroll position.
4. The side panel shows priority, status, an SLA card, the assigned agent, customer contact detail, and the ticket's category and channel — all visible while the message list scrolls independently.
5. Sending a reply appends a message with the correct author, timestamp and channel tag, bumps the ticket's `updated_at`, bumps the customer's `last_contact_at`, and records one `ticket_events` row.
6. An empty reply is refused on both sides; a failed send keeps the drafted text and offers **Retry**.
7. Changing status, priority or assignee from the panel goes through Story 04's `PATCH /api/tickets/{ticket}`, so the change lands in `ticket_events` with actor and timestamp, and is visible in the panel's **Activity** list without a reload.
8. Under RTL the panel sits on the visual left, bubble tails and directional icons mirror, and the list still reads top-to-bottom chronologically.

**Not in scope, and named here so nobody re-derives it:** SLA computation and the `first_response_due_at` / `resolution_due_at` columns (Story 06) · quick replies, internal notes, tasks, @mentions (Story 10) · CSAT (Story 13) · real channel-provider send/receive · WebSocket delivery · message editing or deletion · attachments · **AI-suggested replies (see Product rules — the affordance is not rendered at all)**.

---

## Context — Read These Files First

1. [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md) **lines 1463–1560** — the whole `## Shared contracts this story establishes` section. **Everything in it is verbatim law for this story.** In particular: the `ticket_events` column list (line 1502), the `TicketResource` JSON block (lines 1508–1535), the route table (lines 1536–1548), and the `ticketKeys` rule (line 1551).
2. [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md) **line 1156** — *"The row is not a link and has no click handler. There is no `/tickets/{id}` route until Story 05. Do not add one."* **This story is the one that adds it.**
3. [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md) **lines 379–425** (the `ticket_events` migration and `TicketEvent` model) and **lines 712–833** (the `TicketController` action signatures, `store()`, `update()`, `bulk()` and `meta()`). This story **extends `store()` by four lines** and **adds one key to `meta()`**; it does not touch `index()`, `update()`, `bulk()` or `events()`.
4. [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md) **lines 1157–1178** — `ChannelIcon`'s five verbatim SVG paths and `SlaCell`'s four-branch rule. **Reuse both. Do not draw a second channel glyph set.**
5. [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md) **lines 155–162** (the `customers` columns, `last_contact_at` at line 157), **lines 190–212** (the `CustomerResource` shape — `email`, `phone`, `company`, `tier_label`, `initials`, `created_at`), **line 255** (`index.ts` is the only public surface), **lines 855–866** (the hooks folder: `useCustomer.ts` and `useCustomerSearch.ts` both exist), **lines 938–948** (`customerKeys`).
6. `docs/design/references/3.Conversation Thread/WisalConversationThread-LightLTR.dc.html` — **the primary reference. Build from it; do not invent UI.** 192 lines. Read:
   - **Lines 46–68** — the header bar. This is the *artboard's own* header, and the running app already has one (`AppLayout.tsx` lines 125–217). Take from it only the **left cluster**: a **"Back to Tickets"** text button in `#4F46E5` at `12.5px/600` with a `M15 6l-6 6 6 6` chevron (line 48), a `1px × 20px #E2E8F0` divider (line 49), `#4821` at `14px/700` (line 50), and the subject at `13.5px #334155` with `overflow:hidden;text-overflow:ellipsis;white-space:nowrap` (line 51). **Ignore lines 53–67 — search, theme toggle, language, notifications and the user chip are the shell's, already built.**
   - **Line 70** — the split: `flex:1; display:flex; min-height:0`. **`min-height:0` is what makes the two columns scroll independently instead of growing the page.**
   - **Line 72** — the thread column: `flex:1; display:flex; flex-direction:column; min-width:0; border-right:1px solid #E2E8F0`.
   - **Line 73** — the scroll region: `flex:1; overflow-y:auto; padding:22px 26px; display:flex; flex-direction:column; gap:16px`.
   - **Lines 75–81** — an **inbound email** message: 32px `#E0E7FF`/`#4F46E5` initials avatar, `flex-shrink:0`; body column `max-width:70%`; meta line at `gap:6px; margin-bottom:4px` holding the author at `12.5px/700`, a 13px `#64748B` channel glyph, and `Email · Aug 22, 8:02 AM` at `11px #94A3B8`; bubble `background:#fff; border:1px solid #E2E8F0; border-radius:10px; border-top-left-radius:2px; padding:12px 14px; font-size:13px; line-height:1.6; color:#334155`.
   - **Lines 83–89** — an **outbound agent** message: the row is `flex-direction:row-reverse`, the meta line is `row-reverse` too, the author reads `Sarah Ahmed (You)`, the avatar is solid `#4F46E5`/`#fff`, and the bubble is `background:#4F46E5; color:#fff` with `border-top-right-radius:2px` and **no border**.
   - **Lines 91–99 and 109–115** — **inbound WhatsApp**: bubble `background:#DCFCE7; color:#14532D`, no border, `border-top-left-radius:2px`. Note the avatar here is the WhatsApp glyph rather than initials — **that inconsistency is corrected, not copied**; see Product rules.
   - **Lines 101–107** — the **internal note**. **Story 10 owns this.** Read it only so you recognise it and leave the shape unclaimed: do not add its tokens, its `INTERNAL NOTE` chip, or its `#FFFBEB`/`#FDE68A` bubble in this story.
   - **Lines 119–135** — the composer: `border-top:1px solid #E2E8F0; padding:14px 22px; display:flex; flex-direction:column; gap:10px`. **Lines 120–125 are the AI-suggestion chip — not rendered by this story** (Product rules). Line 127 is the channel control. Lines 129–134 are the input card: `background:#fff; border:1px solid #E2E8F0; border-radius:10px; padding:10px 12px`, placeholder **"Type a reply…"** at `13px #94A3B8`, and a right-aligned **Send** button — `background:#4F46E5; color:#fff; border-radius:8px; padding:8px 16px; font-size:12.5px/700`, arrow `M5 12h14 M13 6l6 6-6 6`.
   - **Lines 139–180** — the metadata panel: `width:300px; flex-shrink:0; background:#fff; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:18px`. Section label style is `11px/700 #94A3B8; letter-spacing:.05em; margin-bottom:8px`. Sections in order: **TICKET DETAILS** (two badges at `10.5px/700; border-radius:6px; padding:4px 8px`, then the SLA card at lines 146–149 — `background:#FEF2F2; border:1px solid #FECACA; border-radius:8px; padding:10px 12px`, label `12px/600 #991B1B`, value `15px/700 #B91C1C`), **ASSIGNED AGENT** (lines 152–157), **CUSTOMER** (lines 160–171), **TAGS** (lines 174–178).
7. `docs/design/references/3.Conversation Thread/WisalConversationThread-DarkLTR.dc.html` — 189 lines, the dark palette. Read **line 71** (column divider `#2A2C33`), **line 75** (avatar `rgba(129,140,248,0.18)` / `#A5B4FC`), **line 78** (inbound bubble `#1C1D24` on `1px solid #2A2C33`, text `#CBD5E1`; meta timestamp `#64748B`), **line 86** (outbound bubble `#818CF8` with `color:#121317; font-weight:500` — **the dark outbound bubble carries a weight the light one does not**), **line 96** (WhatsApp bubble `rgba(52,211,153,0.14)` / `#D1FAE5`), **line 91** (WhatsApp-tinted avatar `rgba(52,211,153,0.18)` / `#34D399`), **line 135** (panel `#1C1D24`), **line 137** (section label `#64748B`), **lines 142–146** (dark SLA card `rgba(248,113,113,0.1)` on `1px solid rgba(248,113,113,0.3)`, label `#FCA5A5`, value `#F87171`), **line 154** (agent card `#202128` on `#2A2C33`).
8. `docs/design/references/3.Conversation Thread/WisalConversationThread-LightRTL.dc.html` — 183 lines. **This export is correct; there is no mirroring defect to fix here** (unlike the queue's pagination chevrons). Verify and reproduce:
   - **Line 18** — `dir="rtl"` on the frame, font family `'IBM Plex Sans Arabic'`.
   - **Line 45** — the back button's chevron **is** mirrored to `M9 6l6 6-6 6`, and its label follows the icon.
   - **Line 47** — `#4821` carries `direction:ltr` so it never renders as `4821#`.
   - **Line 67** — the thread column's divider becomes `border-left`. **Implement with `border-inline-end`, not a direction test.**
   - **Lines 74, 90, 98, 106** — inbound bubbles take `border-top-right-radius:2px`; **line 82** — the outbound bubble takes `border-top-left-radius:2px`. **The tail mirrors. Use `border-start-start-radius` / `border-start-end-radius`, not four hard-coded corners.**
   - **Lines 73, 81, 89, 105** — every clock time is wrapped in `<span style="direction:ltr;display:inline-block;">`.
   - **Line 124** — the Send arrow **is** mirrored to `M19 12H5 M11 6l-6 6 6 6`.
   - **Lines 139, 158, 160** — the SLA value, the customer's email and the phone number all carry `direction:ltr`.
   - **The metadata panel is the last child in DOM order in every variant**, so `dir="rtl"` alone moves it to the visual left. **Do not reorder the DOM for RTL** — `docs/design/brief.md` lines 161–163 require the panel to mirror, and flex under `dir` already does it.
9. **Grep before you copy.** `STATUS.md` lines 49–53 records the recurring export defect — a class used in markup with no rule in `<style>`. **Verified at plan time across all four files in `docs/design/references/3.Conversation Thread/`: the only class used anywhere is `fv`, and `.fv:focus-visible` is defined (LightLTR line 14). No missing-class defect.** The real gap is the same as the queue's: **the exports contain no `<textarea>`, no `<button type="submit">`, no `<ol>`/`<li>`, no `aria-live`, and no `aria-*` on the thread.** The accessible structure in Frontend Task 5 is entirely new work.
10. `docs/design/brief.md` **lines 152–163** — the Conversation Thread paragraph, **binding**: one continuous thread regardless of channel; a persistent side panel; AI-assist inline near the composer; and the **RTL rule** (panel to the visual left, bubbles still chronological top-to-bottom). Also **lines 181–187** (all four states, plus a Confirmation state naming the specific record), **lines 189–197** (accessibility: `outline:none` without a replacement is forbidden, `prefers-reduced-motion` respected, **colour is never the only signal**), **lines 219–220** (*"Do not fragment a ticket's history by channel"*).
11. `api/app/Models/Ticket.php` — the whole file, 33 lines, **as Story 04 leaves it**. `scopeVisibleTo()` at **lines 26–32** is the security boundary this story routes every read through. **Do not replace it with a client-side filter.**
12. `api/database/migrations/2026_08_25_200000_create_audit_logs_table.php` **lines 24–26** — the precedent for a **driver-conditional** migration statement (`if (DB::connection()->getDriverName() === 'pgsql')`). Runtime is **PostgreSQL** (`api/.env`, `DB_CONNECTION=pgsql`); tests run **SQLite `:memory:`** (`api/phpunit.xml` lines 26–27). **Every statement this story writes must be valid on both** — verified: nothing in Backend Task 1 needs the guard.
13. `api/routes/api.php` — the whole file, 18 lines today; **as Story 04 leaves it**, seven ticket routes inside the `auth:sanctum` group. This story appends two lines inside the same group. **Do not add a middleware group, a prefix, or a throttle.**
14. `web/src/App.tsx` **lines 45–49** — `/tickets` is at line 45 (a `PagePlaceholder` today, `TicketQueuePage` after Story 04). This story adds one sibling `<Route>`. **`navItems.tsx` is not edited** — the detail screen is not a nav destination.
15. `web/src/index.css` — the **four** token blocks that every new token must appear in: bare `:root` (**lines 20–47**), `@media (prefers-color-scheme: dark)` (**line 49**), `:root[data-theme="dark"]` (**line 77**), `:root[data-theme="light"]` (**line 102**). Also **`.shell` line 160–166** (`min-height:100vh`, `display:flex`), **`.shell-column` lines 264–269** (`flex:1; flex-direction:column`), **`.shell-header` lines 271–279** (`block-size: var(--header-height)`, `flex-shrink:0`), and **`.shell-main` lines 415–421** (`flex:1; min-inline-size:0; overflow-x:auto; padding-block:24px; padding-inline:28px`). **The detail screen must not add its own outer padding** — and its height must be computed from `--header-height` plus that `padding-block`; see Frontend Task 4.
16. `web/src/lib/api.ts` **lines 14–26** — the one Axios instance and the only place a Bearer token is attached. `web/src/lib/queryClient.ts` **lines 3–13**.
17. `web/src/app/navigation/navRoutes.test.tsx` **lines 13–60** and `web/src/app/layouts/AppLayout.test.tsx` **lines 10–45** — **the frontend test precedent. Copy it; do not invent a new one.** `vi.mock('../../lib/api')` spreading `importActual` and replacing only `api`; a `makeUser()` factory; a `SignedInAs` wrapper that drives a real `login()` through `AuthProvider` rather than hand-mocking `useAuth`.
18. `.squad/stories/conversation-thread/WIS-3/intake.md` — the nine acceptance criteria. `attachments/` is **empty**; there is nothing else to open.

---

## Product rules — where this plan resolves a conflict

Each row is a deliberate decision, verified against the file it cites. Do not silently revert one.

| Source says | This plan does | Why |
|---|---|---|
| Shared contract 5 in the planning contracts: *one frontend feature folder per slug, `web/src/features/<slug>/`* | **The thread ships inside `web/src/features/tickets/`**, alongside the queue, and `features/tickets/index.ts` gains exactly one export: `TicketDetailPage`. **No `web/src/features/conversation-thread/` folder is created.** | The thread is the *detail view of the ticket entity*. It shares `ticketKeys`, the `Ticket` type, `PriorityBadge`, `StatusBadge`, `SlaCell` and `ChannelIcon`, and — per Story 04 line 1065 — it must invalidate the **same** `ticketKeys.all` root. A second folder would either duplicate all of that or reach through `features/tickets/`'s barrel into deep files, which the same contract forbids. The slug names the *plan*, not a directory. |
| The design artboard renders the thread flush against the header, edge to edge (LightLTR line 70) | **The thread renders as a bordered, rounded card inside `.shell-main`'s existing `24px / 28px` gutter.** `.shell-main` (`index.css` lines 415–421) is **not edited**. | Story 02 owns the shell and gives every screen the same gutter; cancelling it with a negative margin fights `overflow-x:auto` on the same element and breaks at the 1024px drawer breakpoint. The artboard draws a whole browser window, not a screen inside this shell — the queue reads the same way and ships inside the gutter. |
| The artboard's header bar (LightLTR lines 46–68) carries search, theme, language, notifications and the user chip | **Only the left cluster is built** — Back to Tickets, divider, `#{id}`, subject. Everything from line 53 rightwards already exists in `AppLayout.tsx` lines 141–213 and is **not duplicated**. | The export is a full-window artboard; the app has a persistent shell header. Rendering a second copy of the notification bell would put two bells on one screen and break the slot Story 11 owns. |
| The artboard renders WhatsApp messages with the **channel glyph as the avatar** (lines 92–94, 110) and email messages with **initials as the avatar plus a glyph in the meta line** (lines 76–78) | **One rule everywhere: the avatar is always the author's initials; the channel glyph always sits in the meta line next to the timestamp.** The avatar's *tint* varies by channel (`--msg-wa-*` for WhatsApp, `--thread-avatar-*` otherwise) so the export's colour cue survives. | The export renders the same fact two different ways within one screen. Initials answer "who", the glyph answers "over what" — collapsing them loses the author on exactly the messages where the channel switched, which is the case this screen exists to make legible (`brief.md` lines 154–156). |
| The artboard uses a filled 32-viewBox WhatsApp mark (line 93) | **Use Story 04's `ChannelIcon` and its five verbatim paths** (Story 04 plan lines 1159–1165), adding an **optional `size` prop defaulting to the current 15px**. | One channel glyph set across queue, thread and dashboard. Two marks for the same channel is how a design system starts drifting. The `size` prop is purely additive — the queue's rendering is byte-identical. |
| The artboard's composer shows an **AI suggested reply** chip with **Use** / **Dismiss** (lines 120–125); the brief (line 158) wants AI-assist inline; the intake defers AI entirely | **The chip is not rendered. There is no "Coming soon" pill, no disabled button, no placeholder text.** The composer's first child is `<div className="thread-assist-slot" />`, which renders `null` and reserves the position immediately above the channel control. | Story 04's inert attachment drop zone works because "attach a file" is self-evidently a stub. A *suggested reply* is different: a hard-coded sentence lies about its provenance, and an empty chip labelled "AI suggestion" is a promise the product does not keep. The brief's "inline near the composer" requirement is satisfied **structurally** — by the slot's position — and by nothing else. **When AI lands, it fills this node and moves no other element.** |
| The artboard's channel control reads **"Reply via WhatsApp"** with a chevron (line 127), implying a picker | **Render it as a read-only indicator, chevron removed**, showing the ticket's own `channel` and its label. `POST /api/tickets/{ticket}/messages` **accepts no `channel` field**; the server copies `$ticket->channel`. | The intake's out-of-scope list is explicit: no provider is wired, and *"the composer only sends through one internal reply channel for this story"*. A picker would let the client claim a message went out over WhatsApp when nothing sent it — a false audit trail is worse than a missing feature. A later Integrations story adds the field and the chevron together. |
| The intake AC: *"a ticket with messages logged from multiple channels"* | Multi-channel threads exist because **`ticket_messages.channel` is written per row and seeded that way** (Backend Task 7), not because the composer can choose. | The AC is about *rendering* one continuous list across channels. That is fully testable with mixed-channel rows regardless of how they got there. |
| The artboard's panel shows the assigned agent's job title — **"Sr. Support Agent"** (line 155) | **Render the agent's name and initials only.** No role line. | `TicketResource.assignee` is pinned to `{id, name, initials}` and *"NEVER carries email"* (Story 04 line 1522). Widening a frozen resource to print a subtitle is not a trade worth making, and `GET /api/users` belongs to Story 08. |
| The artboard's panel shows a **TAGS** section with `account-access` / `password-reset` chips (lines 174–178) | **The section is relabelled `CLASSIFICATION` and renders two real chips: the ticket's `category_label` and its `channel_label`.** No `tags` table, no `tags` column, no free-text tagging. | `tickets` has **no** tag column (Story 04's final column table, line 1480 onwards) and Story 04 deliberately kept `category` a string against `Ticket::CATEGORIES`. Inventing a tag entity here means a table, a many-to-many, an editor and an admin screen — none of which any story owns. Two chips that are true beat two chips that are fabricated, and the block's geometry is unchanged. |
| The artboard's panel shows a live SLA countdown — `SLA breach in` / `12m` (lines 146–149) | **The card renders all four `sla.risk` branches now and shows the `null` branch until Story 06 lands**: neutral tint, label **"SLA"**, value **"Not configured"**, `aria-label="SLA not configured"`. | Identical to Story 04's `SlaCell` decision (plan lines 1171–1178). `TicketResource.sla` is `{due_at, minutes_left, risk}` and every value is `null` until Story 06. Deriving a countdown from `created_at` ships a number that means nothing. **The card, its four branches and its tokens exist from this story; Story 06 changes only the API.** |
| Nothing in the design shows how a status or priority change is made from the detail view; intake AC 7 requires it and requires the change in ticket history | **The two badges become buttons that open a small popover of choices**, and the change goes through Story 04's existing `PATCH /api/tickets/{ticket}`. **No new write endpoint, no duplicated transition graph.** | Story 04's `update()` already gates transitions, writes `resolved_at`/`closed_at`, and appends `status_changed` / `priority_changed` to `ticket_events` with the actor. Re-implementing any of that here is how the two drift. |
| The client would have to guess which status transitions are legal, or eat a 422 | **`GET /api/tickets/meta` gains one additive key, `transitions`**, a static map from `TicketStatus::allowedTransitions()`. No existing key is renamed or removed. | The enum stays the sole authority (Story 04 line 1471); the client only *reads* it, so it can grey out `Resolved → Pending` instead of offering it and failing. Additive keys on `meta()` are safe — Story 04's own note at line 833 freezes the `agents` key's *shape*, not the object's key set. |
| `POST /api/tickets` (Story 04) creates a ticket with a `description` but no message, so a brand-new ticket's thread is empty | **Story 04's `store()` gains four lines: when `description` is non-empty, insert the opening `ticket_messages` row** — `author_type: 'customer'`, the ticket's `customer_id` and `channel`, `body` = the description. | The customer's original request *is* the first message; the design's first bubble is exactly that (LightLTR line 79). Rendering `description` as a separate pinned card above the list would fragment the thread, which `brief.md` line 219 forbids. This is the only edit this story makes to a Story 04 file, and it is additive. |
| Intake AC 5: an unauthorised agent must see *"the specific denial reason … never a generic error"* | **`TicketPolicy::view()` is left byte-for-byte unchanged.** The 403 is rendered by a dedicated `ThreadForbidden` component whose copy is authored on the client. | Story 04 line 1567 and `tests/Feature/TicketScopeTest.php` both depend on `view()` returning a bool. The specific reason an agent needs — *this ticket is assigned to someone else; ask a Team Lead to reassign it* — is a **client-side** fact derivable from the 403 plus the current user's role, and putting it in the API response would tell an unauthorised caller who owns a ticket they cannot see. |
| The intake's technical hint: *"Consider cursor-based pagination … rather than offset"* | **Cursor pagination, `orderBy('id', 'desc')`, `cursorPaginate(30)`.** | An offset page-2 on a thread that gains a message while the agent reads it silently duplicates or skips a row. `id` is monotonic and unique, so the cursor is stable on both PostgreSQL and SQLite. |
| Newest-first paging vs. oldest-first reading | **The API returns each page newest-first; the client reverses it for display and prepends older pages above.** | The agent needs the *newest* messages instantly, which is what a cursor on `id DESC` gives in one query. Reading order is a presentation concern and costs one `.reverse()`. |
| Auto-loading older messages on scroll | **An explicit "Load earlier messages" button at the top of the list.** No `IntersectionObserver`. | Scroll-triggered loading fights scroll-position restoration on prepend, and jsdom reports every element as 0×0, so the behaviour is untestable in the suite this repo runs (`web/vitest` + jsdom 29). A button is testable, keyboard-reachable, and announces itself. |

---

## Backend Tasks

Every path in this section is relative to `api/`.

### 1 — Migration: the `ticket_messages` table

**Create file: `database/migrations/2026_08_27_120300_create_ticket_messages_table.php`**

> Implementation note: the timestamp is `2026_08_27_120300` (not the plan's original `100000`) so the migration runs **after** `create_customers_table` (`111743`) and `create_ticket_events_table` (`120200`). PostgreSQL rejects a foreign key to a table that does not yet exist; SQLite tolerates the forward reference, which is why the earlier ordering passed the test suite but failed `php artisan migrate` on pgsql.

```php
Schema::create('ticket_messages', function (Blueprint $table) {
    $table->id();
    $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
    $table->string('author_type', 16);                 // customer | agent | system
    $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
    $table->string('channel', 16);                     // App\Enums\Channel value
    $table->text('body');
    $table->timestamps();

    $table->index(['ticket_id', 'id']);
    $table->index(['ticket_id', 'created_at']);
});
```

- **`cascadeOnDelete()` on `ticket_id`** — a message has no meaning without its ticket, matching `ticket_events` (Story 04 plan line 382).
- **`nullOnDelete()` on both author FKs** — a deleted agent or customer must not erase the fact that a message was sent. Both render as **"Deleted user"** / **"Deleted customer"**.
- **`customer_id` is `nullOnDelete`, not `restrictOnDelete`.** `tickets.customer_id` restricts (Story 04's contract table), which is what actually protects a customer with live tickets; a second restrict on the message table would make a customer with 400 archived messages permanently undeletable.
- **`author_type` is a `string(16)`, not an `App\Enums` enum.** It has exactly three values and no behaviour hangs off it. Story 04's rule for `category` applies verbatim: a closed set that seven stories bind code to earns an enum; a three-value discriminator does not. **Validate against `TicketMessage::AUTHOR_TYPES`.**
- **`channel` is a plain `string(16)` cast to `Channel`** — identical to `tickets.channel`.
- **`timestamps()`, not a bare `created_at`.** Unlike `ticket_events`, messages are **not** append-only forever: Story 10 adds `visibility` and Story 13 attaches a survey result to a message row. `ticket_events` is the audit trail; this is content.
- **Index `(ticket_id, id)` is the cursor-pagination index**; `(ticket_id, created_at)` serves the `last_contact_at` and activity reads. **Both forms are valid on PostgreSQL and SQLite — no `DB::connection()->getDriverName()` guard is needed anywhere in this story.**
- **Do not add `visibility`.** Story 10 adds it in `add_visibility_to_ticket_messages_table` (its plan, lines 130–132). Adding it here and leaving it unused would leave two owners for one column.

`down()` is `Schema::dropIfExists('ticket_messages');`.

### 2 — `app/Models/TicketMessage.php`

**Create file: `app/Models/TicketMessage.php`** — follow the shape of `app/Models/TicketEvent.php` (Story 04 plan lines 404–425):

```php
class TicketMessage extends Model
{
    use HasFactory;

    public const AUTHOR_CUSTOMER = 'customer';
    public const AUTHOR_AGENT    = 'agent';
    public const AUTHOR_SYSTEM   = 'system';

    /** The closed set. Story 13 writes `system`; nothing in Story 05 does. */
    public const AUTHOR_TYPES = [self::AUTHOR_CUSTOMER, self::AUTHOR_AGENT, self::AUTHOR_SYSTEM];

    protected $fillable = [
        'ticket_id', 'author_type', 'user_id', 'customer_id', 'channel', 'body',
    ];

    protected function casts(): array
    {
        return ['channel' => Channel::class];
    }

    public function ticket(): BelongsTo { return $this->belongsTo(Ticket::class); }

    public function author(): BelongsTo { return $this->belongsTo(User::class, 'user_id'); }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
}
```

**File: `app/Models/Ticket.php` — add one relation. Change nothing else.** `$fillable`, `assignee()` and `scopeVisibleTo()` stay exactly as Story 04 leaves them.

```php
public function messages(): HasMany
{
    return $this->hasMany(TicketMessage::class)->orderBy('id');
}
```

### 3 — `app/Http/Requests/StoreTicketMessageRequest.php`

**Create file:**

```php
public function authorize(): bool
{
    return $this->user()->can('update', $this->route('ticket'));
}

public function rules(): array
{
    return [
        'body' => ['required', 'string', 'min:1', 'max:10000'],
    ];
}

public function messages(): array
{
    return ['body.required' => 'Write a reply before sending.'];
}

protected function prepareForValidation(): void
{
    $this->merge(['body' => is_string($this->body) ? trim($this->body) : $this->body]);
}
```

- **`prepareForValidation()` trims first, so `required` sees the trimmed value.** Without it, `"   "` is a non-empty string and passes `required` — that is exactly the empty-reply the intake's AC 4 forbids, and it is the single most likely way this endpoint ships broken.
- **`update` is the ability, not a new one.** Story 04's `TicketPolicy::update()` is `view()` — *if you can see it, you can work it*. Replying is working it. **Do not add a `reply` ability.**
- **`channel`, `author_type`, `user_id` and `visibility` are not accepted.** The server derives the first three; the fourth belongs to Story 10.

### 4 — `app/Http/Resources/TicketMessageResource.php`

**Create file.** The full shape is pinned in **Shared contracts this story establishes**; build it exactly:

```php
public function toArray(Request $request): array
{
    return [
        'id'           => $this->id,
        'ticket_id'    => $this->ticket_id,
        'author_type'  => $this->author_type,
        'author'       => $this->authorPayload(),
        'is_mine'      => $this->author_type === TicketMessage::AUTHOR_AGENT
                          && $this->user_id === $request->user()?->id,
        'channel'      => $this->channel->value,
        'channel_label'=> $this->channel->label(),
        'body'         => $this->body,
        'created_at'   => $this->created_at,
    ];
}
```

`authorPayload()` is a private method on the resource returning `['id' => …, 'name' => …, 'initials' => …]` or `null`:

- `author_type === 'agent'` → the `author` relation, `initials` from the same two-letter rule Story 03 uses for `Customer::initials()` (its plan line 468).
- `author_type === 'customer'` → the `customer` relation.
- `author_type === 'system'` → **`null`**, and the SPA renders the system label.
- A deleted author (both FKs `null` after `nullOnDelete`) → **`null`** with `author_type` intact, so the SPA can still say who *kind of* sent it.

**`author` never carries an email, a phone number, or a role** — the same rule that guards `TicketResource.assignee` (Story 04 line 1522). The thread is a screen an agent may open for a ticket whose customer they are not otherwise entitled to browse; contact details reach the side panel through `GET /api/customers/{customer}`, which has its own policy.

**`is_mine` is computed per request, so this resource must never be cached across users.** It drives only the `(You)` suffix — **bubble alignment is driven by `author_type === 'agent'`, not by `is_mine`**, because another agent's reply is still an outbound message.

### 5 — `app/Http/Controllers/TicketMessageController.php`

**Create file.** Two actions. **`use AuthorizesRequests;`** exactly as `TicketController` does (its line 13).

```php
public function index(Request $request, Ticket $ticket): AnonymousResourceCollection
{
    $this->authorize('view', $ticket);

    $messages = $ticket->messages()
        ->reorder('id', 'desc')                       // newest first — the cursor's order
        ->with(['author:id,name', 'customer:id,name'])
        ->cursorPaginate(30)
        ->withQueryString();

    return TicketMessageResource::collection($messages);
}
```

- **`reorder()`, not `orderBy()`.** `Ticket::messages()` already applies `orderBy('id')`; `orderBy` would append a second, contradictory clause and `cursorPaginate` would build its cursor from the wrong column.
- **`authorize('view', $ticket)` before anything else.** Route-model binding resolves the ticket without applying `visibleTo()`, so this line — not the query — is the boundary.
- **Column-limited eager loads.** `author:id,name` and `customer:id,name` keep emails and phone numbers out of the payload by construction rather than by remembering to omit them in the resource.
- **Fixed page size of 30. `per_page` is not accepted.** The queue's 10/25/50 exists because a table's density is the user's choice; a thread's page size is an implementation detail, and letting a client ask for 5 000 messages is a denial-of-service with extra steps.

```php
public function store(StoreTicketMessageRequest $request, Ticket $ticket): JsonResponse
{
    $message = DB::transaction(function () use ($request, $ticket) {
        $message = $ticket->messages()->create([
            'author_type' => TicketMessage::AUTHOR_AGENT,
            'user_id'     => $request->user()->id,
            'customer_id' => null,
            'channel'     => $ticket->channel,        // never client-supplied
            'body'        => $request->validated('body'),
        ]);

        $ticket->touch();                             // AC: last activity is bumped

        TicketEvent::create([
            'ticket_id'  => $ticket->id,
            'user_id'    => $request->user()->id,
            'event'      => 'replied',
            'field'      => null,
            'old_value'  => null,
            'new_value'  => (string) $message->id,
            'created_at' => $message->created_at,
        ]);

        Customer::whereKey($ticket->customer_id)
            ->where(fn ($q) => $q->whereNull('last_contact_at')
                                 ->orWhere('last_contact_at', '<', $message->created_at))
            ->update(['last_contact_at' => $message->created_at]);

        return $message;
    });

    return (new TicketMessageResource($message->load(['author:id,name'])))
        ->response()->setStatusCode(201);
}
```

- **One transaction.** A message without its `last_contact_at` bump is a customer record that lies about when they were last spoken to; a `last_contact_at` without its message is worse.
- **The `last_contact_at` write is conditional, not unconditional.** A backfilled or out-of-order write must never move the value *backwards*. `whereNull(...)->orWhere('<', …)` is one statement, valid on both drivers, and race-safe without a lock — **do not read-then-write in PHP**.
- **`'replied'` is the one new `ticket_events` value this story adds.** `new_value` is the message id as a string, matching the column's `string` type (Story 04 line 1502) — **do not widen `old_value`/`new_value` to JSON**.
- **Nothing is written to `audit_logs`.** Story 04's rule, restated because it is the easy mistake here.
- **`201`, with the created message as the body.** The SPA appends it directly rather than refetching the newest page.

### 6 — Two additive edits to Story 04 files

Both are **additive**. Do not restructure either method.

**File: `app/Http/Controllers/TicketController.php` — inside `store()`, immediately after `$ticket = Ticket::create($data);`** (Story 04 plan line 739):

```php
// Story 05: the customer's original request IS the first message in the thread.
if (filled($ticket->description)) {
    $ticket->messages()->create([
        'author_type' => TicketMessage::AUTHOR_CUSTOMER,
        'user_id'     => null,
        'customer_id' => $ticket->customer_id,
        'channel'     => $ticket->channel,
        'body'        => $ticket->description,
    ]);
}
```

**No `TicketEvent` row is written here** — Story 04 already writes `created`, and a `replied` event for the customer's own opening line would be noise.

**File: `app/Http/Controllers/TicketController.php` — inside `meta()`**, add one key to the returned array (Story 04 plan lines 815–830). **Change no existing key:**

```php
'transitions' => collect(TicketStatus::cases())
    ->mapWithKeys(fn (TicketStatus $s) => [
        $s->value => array_map(fn (TicketStatus $t) => $t->value, $s->allowedTransitions()),
    ])
    ->all(),
```

### 7 — Routes, factory, seeder

**File: `routes/api.php` — append two lines inside the existing `auth:sanctum` group**, after `GET /tickets/{ticket}/events`:

```php
Route::get('/tickets/{ticket}/messages', [TicketMessageController::class, 'index']);
Route::post('/tickets/{ticket}/messages', [TicketMessageController::class, 'store']);
```

**Order does not matter for these two** — neither collides with `/tickets/meta`, because both sit one segment deeper. **Do not move `/tickets/meta`**; it must stay above `/tickets/{ticket}` (Story 04 line 837).

**Create file: `database/factories/TicketMessageFactory.php`** — the second factory in the repo (`UserFactory.php` is the only one today; Story 03 and Story 04 add `CustomerFactory` and `TicketFactory`). Default state: `author_type` `customer`, `channel` `email`, `body` from `fake()->paragraph()`. Provide two states:

```php
public function fromAgent(User $agent): static      // author_type agent, user_id set, customer_id null
public function overChannel(Channel $channel): static
```

**File: `database/seeders/DatabaseSeeder.php` — append, do not restructure.** After Story 04's ticket seeding, give **at least three** seeded tickets a thread that alternates author types **and channels**, so `GET /api/tickets/{id}/messages` demonstrably returns a mixed-channel list and the "Load earlier messages" path is reachable:

- One ticket with **more than 30** messages (the cursor path).
- One ticket with a thread spanning **email → whatsapp → email** (the AC-1 case).
- One ticket with **zero** messages (the Empty state).
- After seeding, set each seeded customer's `last_contact_at` from `MAX(ticket_messages.created_at)` across their tickets, so the customers table's column is coherent with the threads on day one.

### 8 — No policy changes

**`app/Policies/TicketPolicy.php` is not edited by this story.** `view()` gates reading a thread, `update()` gates writing to it, and `assign()` gates the panel's Reassign control. All three already exist from Story 04. **Do not add a `TicketMessagePolicy`** — a message has no authorization identity separate from its ticket, and a second policy is a second place for the two to disagree.

---

## Frontend Tasks

Every path is relative to `web/`. **The thread lives in the existing `features/tickets/` folder** (Product rules). New files only:

```
web/src/features/tickets/
  api/
    messagesApi.ts                fetchMessages(id, cursor) · sendMessage(id, body)
  model/
    ticketMessage.ts              TicketMessage + CursorPaginated<T>
    replySchema.ts                zod — the composer's single source of type + validation
  hooks/
    useTicketDetail.ts            GET /api/tickets/{id}          -> ticketKeys.detail(id)
    useTicketMessages.ts          useInfiniteQuery, cursor       -> ticketKeys.messages(id)
    useSendReply.ts               POST, invalidates ticketKeys.all
    useTicketEvents.ts            GET /api/tickets/{id}/events   -> ticketKeys.events(id)
    useTicketAttributeMutation.ts PATCH status | priority | assigned_to
    useThreadScrollAnchor.ts      pin-to-bottom + restore-on-prepend
  components/thread/
    ThreadTopBar.tsx              back link · #id · subject
    MessageList.tsx               the <ol>, the scroll container, the load-earlier control
    MessageBubble.tsx             one <li>
    MessageMeta.tsx               author · channel glyph · timestamp
    Avatar.tsx                    initials, channel-tinted
    ReplyComposer.tsx             textarea + Send + error + retry
    ComposerChannelBadge.tsx      read-only channel indicator
    TicketMetaPanel.tsx           the 300px column
    SlaCard.tsx                   four risk branches
    AssignedAgentCard.tsx         name + Reassign
    CustomerInfoCard.tsx          from GET /api/customers/{id}
    ClassificationCard.tsx        category + channel chips
    ActivityList.tsx              ticket_events
    AttributePopover.tsx          status / priority chooser
    ThreadSkeleton.tsx  ThreadEmpty.tsx  ThreadError.tsx  ThreadForbidden.tsx
  pages/
    TicketDetailPage.tsx
```

**`features/tickets/index.ts` gains exactly one line:** `export { TicketDetailPage } from './pages/TicketDetailPage';`. Nothing else in that barrel changes.

### 1 — Design tokens

**File: `web/src/index.css` — extend.** Add every token below to **all four** blocks (`:root` line 20, `prefers-color-scheme` line 49, `[data-theme="dark"]` line 77, `[data-theme="light"]` line 102). Omitting one is how an explicit theme choice stops winning in one direction. Cited lines are `WisalConversationThread-LightLTR.dc.html` / `-DarkLTR.dc.html`.

| Token | Light | Dark | Source |
|---|---|---|---|
| `--msg-in-bg` | `#FFFFFF` | `#1C1D24` | L79 · D78 |
| `--msg-in-border` | `#E2E8F0` | `#2A2C33` | L79 · D78 |
| `--msg-in-fg` | `#334155` | `#CBD5E1` | L79 · D78 |
| `--msg-out-bg` | `#4F46E5` | `#818CF8` | L87 · D86 |
| `--msg-out-fg` | `#FFFFFF` | `#121317` | L87 · D86 |
| `--msg-out-weight` | `400` | `500` | D86 — **the dark outbound bubble is heavier; that is deliberate, not a typo** |
| `--msg-wa-bg` | `#DCFCE7` | `rgba(52,211,153,0.14)` | L97 · D96 |
| `--msg-wa-fg` | `#14532D` | `#D1FAE5` | L97 · D96 |
| `--msg-wa-avatar-bg` / `--msg-wa-avatar-fg` | `#DCFCE7` / `#15803D` | `rgba(52,211,153,0.18)` / `#34D399` | L92 · D91 |
| `--thread-avatar-bg` / `--thread-avatar-fg` | `#E0E7FF` / `#4F46E5` | `rgba(129,140,248,0.18)` / `#A5B4FC` | L76 · D75 |
| `--thread-meta-fg` | `#94A3B8` | `#64748B` | L78 · D77 |
| `--thread-glyph-fg` | `#64748B` | `#94A3B8` | L78 · D77 |
| `--thread-divider` | `#E2E8F0` | `#2A2C33` | L72 · D71 |
| `--meta-panel-bg` | `#FFFFFF` | `#1C1D24` | L139 · D135 |
| `--meta-label-fg` | `#94A3B8` | `#64748B` | L141 · D137 |
| `--meta-card-bg` | `#F8FAFC` | `#202128` | L153 · D154 |
| `--composer-placeholder` | `#94A3B8` | `#64748B` | L130 · D128 |
| `--thread-card-radius` | `12px` | `12px` | **decided in this plan** — the artboard's outer frame is 16px (L22); a card inside the shell gutter matches the queue's table shell |

Two rules a naive pass breaks:

- **`--thread-meta-fg` and `--thread-glyph-fg` swap between themes** (`#94A3B8` ↔ `#64748B`). Copy the table; do not "tidy" them into one token. In light the glyph must read *stronger* than the timestamp beside it; in dark the relationship inverts because the same greys sit on a near-black card.
- **The SLA card gets no tokens of its own.** Its tint is derived from Story 04's existing risk tokens:
  `background: color-mix(in srgb, var(--sla-breached) 10%, transparent); border-color: color-mix(in srgb, var(--sla-breached) 30%, transparent);`
  That reproduces the dark export **exactly** (`rgba(248,113,113,0.1)` / `0.3`, D142) and lands within one step of the light export (`#FEF2F2` / `#FECACA`, L146). Swapping `--sla-breached` for `--sla-at-risk` / `--sla-ok` / `--sla-none` gives the other three branches for free. **Do not add eight more tokens for four card variants.**

### 2 — Types and the reply schema

**Create file: `model/ticketMessage.ts`** — hand-write it against the contract section at the end of this file. **Do not infer it from a sample response.**

```ts
export type MessageAuthorType = 'customer' | 'agent' | 'system';

export type MessageAuthor = { id: number; name: string; initials: string };

export type TicketMessage = {
  id: number;
  ticket_id: number;
  author_type: MessageAuthorType;
  author: MessageAuthor | null;      // null = system, or a deleted user/customer
  is_mine: boolean;
  channel: TicketChannel;            // reuse Story 04's type from './ticket'
  channel_label: string;
  body: string;
  created_at: string;
};

/** Laravel's cursor envelope — NOT the `Paginated<T>` shape the queue uses. */
export type CursorPaginated<T> = {
  data: T[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: { path: string; per_page: number; next_cursor: string | null; prev_cursor: string | null };
};
```

**`CursorPaginated` has no `total` and no `last_page`.** Cursor pagination cannot know either without a second count query. **Do not render "Showing 1–30 of N" on this screen** — the queue's footer pattern does not transfer.

**Create file: `model/replySchema.ts`**

```ts
export const replySchema = z.object({
  body: z.string().trim().min(1, 'Write a reply before sending.').max(10000),
});
export type ReplyValues = z.infer<typeof replySchema>;
```

**`.trim()` runs before `.min(1)`**, mirroring the server's `prepareForValidation()`. The message string is **identical** on both sides so a user never sees two different wordings for the same refusal.

### 3 — API layer, query keys, and the customer barrel

**Create file: `api/messagesApi.ts`** — through the shared instance from `lib/api.ts`. **Do not create a second Axios client and do not set an `Authorization` header.**

```ts
export async function fetchMessages(ticketId: number, cursor?: string | null) {
  const { data } = await api.get<CursorPaginated<TicketMessage>>(
    `/tickets/${ticketId}/messages`,
    { params: cursor ? { cursor } : undefined },
  );
  return data;
}

export async function sendMessage(ticketId: number, body: string) {
  const { data } = await api.post<{ data: TicketMessage }>(`/tickets/${ticketId}/messages`, { body });
  return data.data;
}
```

**File: `api/queryKeys.ts` — extend `ticketKeys`. Do not restructure it.** `all`, `list`, `detail`, `events` and `meta` stay exactly as Story 04 defines them (its plan lines 1056–1062); add one:

```ts
  messages: (id: number) => [...ticketKeys.all, 'messages', id] as const,
```

**Every mutation on this screen invalidates `ticketKeys.all`** — the reply changes the queue row's last-updated, the status change changes its badge, and a narrower invalidation is exactly the stale-queue bug Story 04 line 1065 calls out.

**File: `web/src/features/customers/index.ts` — add two exports.** The side panel needs the customer's email, phone, company and `created_at`, none of which `TicketResource.customer` carries (it is `{id, name}` only, and frozen).

```ts
export { useCustomer } from './hooks/useCustomer';
export { customerKeys } from './api/queryKeys';
```

Both files already exist (Story 03 plan lines 858 and 938). **This is purely additive — no existing export changes, and no file inside `features/customers/` is edited.** The thread imports from `'../../customers'` and **never** from a deeper path.

### 4 — The page shell and its height

**Create file: `pages/TicketDetailPage.tsx`** — route `/tickets/:ticketId`. Composition root; it owns no layout logic beyond the split.

**File: `web/src/App.tsx` — add one route** immediately after `/tickets` (line 45), inside the same layout route:

```tsx
<Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
```

Import from the barrel — `import { TicketQueuePage, TicketDetailPage } from './features/tickets';`. **`navItems.tsx` is not edited** (a detail screen is not a nav destination), so `navRoutes.test.tsx` keeps passing unchanged.

**Height is the one thing that is easy to get wrong.** `.shell` is `min-height:100vh` (index.css line 162), so a `height:100%` chain from `<body>` does not exist. The thread card sizes itself:

```css
.thread-card {
  block-size: calc(100dvh - var(--header-height) - 48px);   /* 48px = .shell-main padding-block ×2 */
  min-block-size: 480px;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: var(--thread-card-radius);
  overflow: hidden;               /* keeps the two inner scrollers inside the rounded corners */
}
```

- **`100dvh`, not `100vh`** — on mobile Safari `100vh` includes the collapsing browser chrome, which pushes the composer under the address bar precisely when the agent is typing.
- **`min-block-size: 480px`** stops the card collapsing to nothing on a short landscape viewport; below that the page scrolls, which is correct.
- **`--header-height` is Story 02's token** (index.css line 41). Reading it rather than hard-coding `68px` means the shell can change its header without silently breaking this screen.
- **`min-height:0` on both inner columns** (matching the export's line 70) — without it a long list grows the flex parent and both scrollbars vanish.

Layout below the top bar: `display:flex` with the thread column (`flex:1; min-inline-size:0; border-inline-end:1px solid var(--thread-divider)`) then the panel (`inline-size:300px; flex-shrink:0`). **Panel last in DOM — RTL is handled by `dir` alone** (Context item 8).

**Responsive.** Below **1024px** (`--shell-breakpoint`, already declared) the two columns stack: the panel moves **above** the thread, loses its fixed width, and `block-size` on `.thread-card` becomes `auto` so the page — not the two inner regions — scrolls. **The panel goes above, not below**: on a phone the metadata is the orienting context, and burying it under a 40-message thread makes it unreachable. This is the only place the "persistent panel" AC bends, and it bends because there is no second column to be persistent in.

### 5 — The message list

**Create file: `components/thread/MessageList.tsx`**

- The scroll region reproduces export line 73: `flex:1; overflow-y:auto; padding:22px 26px; display:flex; flex-direction:column; gap:16px`.
- **The list is an `<ol>`** with `role="list"` retained and each message an `<li>`. The exports have no list semantics at all; a screen reader needs to hear "list, 14 items" and the position of each. **Do not build it from `<div>`s.**
- **Order is oldest → newest, top → bottom, in every direction.** `brief.md` line 162 makes this explicit for RTL. The API returns newest-first; the client reverses. Flatten `useInfiniteQuery` pages as: **reverse each page, then concatenate pages in reverse page order.** Getting this wrong produces a list that is locally correct and globally scrambled — the most likely silent bug in this story.
- **"Load earlier messages"** renders at the top of the scroll region **only while `hasNextPage`**. Disabled and labelled "Loading…" while fetching. `aria-busy` on the list while a prepend is in flight.
- **A day separator** — a centred `11px var(--thread-meta-fg)` rule with the date — is inserted whenever the calendar day changes between two adjacent messages. The export shows one day so it depicts none; a thread spanning a week without them is unreadable. Format with `Intl.DateTimeFormat`, **not a date library** (`web/package.json` has none, and none is added).
- **`aria-live="polite"`** on a visually-hidden region that announces only the newest appended message. **Do not put `aria-live` on the list itself** — a 30-message prepend would be read aloud in full.

**Create file: `components/thread/MessageBubble.tsx`**

- Alignment: `author_type === 'agent'` → the row is `flex-direction: row-reverse`, and so is the meta line (export lines 83, 86). `customer` and `system` → normal order. **`is_mine` does not affect alignment** — it only appends `" (You)"` to the author name.
- Body column: `max-inline-size: 70%` (export line 77). Bubble: `border-radius:10px; padding:12px 14px; font-size:13px; line-height:1.6`.
- **The tail corner uses logical properties**: inbound gets `border-start-start-radius: 2px`, outbound `border-start-end-radius: 2px`. That reproduces the LTR export (lines 79, 87) **and** the RTL export (lines 74, 82) from one declaration. **Do not write four physical corners with a direction test.**
- Palette by `author_type` and `channel`:

  | Case | Background | Foreground | Border |
  |---|---|---|---|
  | agent (any channel) | `--msg-out-bg` | `--msg-out-fg` | none |
  | customer, `channel === 'whatsapp'` | `--msg-wa-bg` | `--msg-wa-fg` | none |
  | customer, any other channel | `--msg-in-bg` | `--msg-in-fg` | `1px solid var(--msg-in-border)` |
  | system | `--meta-card-bg` | `--text-muted` | `1px dashed var(--border-card)` |

  **No branch relies on colour alone**: every bubble's meta line names the channel in words (`brief.md` line 196).
- **`body` renders as plain text with `white-space: pre-wrap`.** **Do not render it as HTML and do not add a Markdown renderer in this story.** A customer-authored message going through `dangerouslySetInnerHTML` is stored XSS. Story 09's article references are Markdown links inserted into the *composer*; rendering them as links is Story 09's follow-up, and it must arrive with a sanitiser, not before one.

**Create file: `components/thread/MessageMeta.tsx`** — export lines 78/86: author at `12.5px/700`, then `ChannelIcon` at 13px in `var(--thread-glyph-fg)` with `role="img"` and the channel label as `aria-label`, then `{channel_label} · {time}` at `11px var(--thread-meta-fg)`.

- **The clock time is wrapped in `<span dir="ltr" style="display:inline-block">`**, matching RTL export lines 73/81/89/105. `8:02 AM` inside an Arabic sentence reorders without it.
- The full timestamp is the element's `title`, so the exact value is always reachable — same rule as the queue's relative time (Story 04 line 1155).
- **`system` messages render no channel glyph** and the author name is the literal **"System"**.
- A `null` author renders **"Deleted user"** (`author_type === 'agent'`) or **"Deleted customer"** (`customer`) in `var(--text-muted)`.

**Create file: `components/thread/Avatar.tsx`** — 32px circle, `flex-shrink:0`, `12px/700` initials. Tint: `whatsapp` → `--msg-wa-avatar-*`; agent → `--btn-bg`/`--btn-text`; everything else → `--thread-avatar-*`. `aria-hidden="true"` — the name is already in the meta line beside it, and a screen reader must not read it twice.

**Create file: `hooks/useThreadScrollAnchor.ts`** — two behaviours, both of which the design implies and neither of which the export contains:

1. **On first successful load, and on every appended own message, scroll to the bottom.** Use `scrollTo({ behavior: prefersReducedMotion ? 'auto' : 'smooth' })`; `prefers-reduced-motion` is honoured per `brief.md` line 195.
2. **On prepend, hold the reading position.** Record `scrollHeight` before the prepend commits (in the mutation's `onSuccess`/`useLayoutEffect` before paint) and set `scrollTop += scrollHeight_after - scrollHeight_before`. **Without this, "Load earlier messages" throws the agent 30 messages up the thread every time they press it.**

### 6 — Queries

**Create file: `hooks/useTicketDetail.ts`** — `useQuery` on `ticketKeys.detail(id)` hitting `GET /api/tickets/{id}` (Story 04's `show()`). **`retry: false` for this query** — the default `retry: 1` from `queryClient.ts` means a 403 is requested twice before the Forbidden state appears, doubling the latency on the one path where the user is already blocked. Leave `queryClient.ts` itself untouched.

**Create file: `hooks/useTicketMessages.ts`**

```ts
useInfiniteQuery({
  queryKey: ticketKeys.messages(ticketId),
  queryFn: ({ pageParam }) => fetchMessages(ticketId, pageParam),
  initialPageParam: null as string | null,
  getNextPageParam: (last) => last.meta.next_cursor,   // "next" page = OLDER messages
});
```

**`getNextPageParam` walks backwards in time.** The names read wrong and that is unavoidable: the API's cursor moves from newest towards oldest, so TanStack's `hasNextPage` means "there are older messages". **Write that in a comment above the hook** — the next person to touch it will otherwise "fix" it into `getPreviousPageParam` and break the prepend.

**Create file: `hooks/useTicketEvents.ts`** — `useQuery` on `ticketKeys.events(id)` hitting Story 04's `GET /api/tickets/{id}/events`. Feeds `ActivityList`.

### 7 — The composer

**Create file: `components/thread/ReplyComposer.tsx`** — export lines 119–135.

Structure, top to bottom, in this exact order:

1. **`<div className="thread-assist-slot" />`** — renders `null`. **This is the AI-assist slot and it is empty.** Add the comment verbatim:
   ```tsx
   {/* AI-suggested reply (design export lines 120-125) is NOT built in this story.
       The intake defers AI; this node reserves the position so the feature lands
       without moving another element. It renders nothing: no pill, no disabled
       button, no "Coming soon". A suggestion the product cannot generate must not
       be depicted. */}
   ```
2. **`ComposerChannelBadge`** — read-only, no chevron (Product rules). Renders `ChannelIcon` + `Reply via {channel_label}` in the WhatsApp tint when `channel === 'whatsapp'`, otherwise `--meta-card-bg`/`--text-muted`. Give it `title="Replies are sent on the ticket's original channel"` and no interactive role.
3. **The input card** — `background: var(--input-bg); border:1px solid var(--border-card); border-radius:10px; padding:10px 12px`.
   - A **`<textarea>`** (the export draws a static div; there is no real control in it), `rows={2}`, auto-growing to a `max-block-size` of `180px` then scrolling. Placeholder **"Type a reply…"** in `var(--composer-placeholder)`.
   - A visually-hidden `<label>` reading **"Reply to ticket #{id}"**.
   - **Ctrl/Cmd + Enter submits. A bare Enter inserts a newline.** Multi-paragraph replies are normal in support; Enter-to-send loses them.
   - **Send** button, right-aligned, `--btn-bg`/`--btn-text`, arrow `M5 12h14 M13 6l6 6-6 6` — **mirrored to `M19 12H5 M11 6l-6 6 6 6` under RTL** (RTL export line 124). **Swap the path; do not apply `transform: scaleX(-1)`**, which also mirrors the focus ring (Story 04's rule at its plan line 138).
   - **Disabled while the trimmed value is empty or a send is in flight.** A disabled button is not the only guard — submitting an empty form still runs `replySchema` and renders the inline message, because a disabled button is invisible to a keyboard user who has not focused it.
4. **The error row**, below the card, rendered only after a failed send: `role="alert"`, the message in `var(--danger-fg)`, and a **Retry** button that re-submits the *same* text.

**Draft preservation (intake AC 9) is the composer's load-bearing behaviour.** The rules:

- The textarea's value lives in component state. **It is cleared in `onSuccess` only** — never in `onSettled`, never optimistically, never in the submit handler.
- On error the value is untouched, the textarea keeps focus, and Retry calls the same mutation with the same string.
- **No optimistic append.** A bubble that appears and then vanishes on a failed send is worse than a spinner. Append on `201`, from the response body.
- `mutations.retry` is `false` globally (`queryClient.ts` line 11) — **do not override it here.** A silent auto-retry on a `POST` that may have succeeded server-side is how a thread gets duplicate messages.

**Story 09 / Story 10 mount points, declared here so those stories do not restructure this file:**

```tsx
type ReplyComposerProps = {
  ticket: Ticket;
  /** Story 09 mounts ArticlePickerPanel against this. Inserts text at the caret. */
  onInsertAtCaret?: (text: string) => void;
  /** Story 10 mounts QuickReplyPicker and the internal-note toggle in this row. */
  toolbarSlot?: React.ReactNode;
};
```

`onInsertAtCaret` is implemented **now**, in this story: it splices `text` into the textarea's value at `selectionStart`, restores the caret after the inserted string, and refocuses. **Story 09 supplies the string** — the format `[<title>](/knowledge-base/<slug>)` is **owned by Story 09** (its plan lines 152–153) and this story neither defines it nor validates it. `toolbarSlot` renders between the channel badge and the input card and is `undefined` until Story 10.

### 8 — The metadata panel

**Create file: `components/thread/TicketMetaPanel.tsx`** — export lines 139–180. `inline-size:300px; flex-shrink:0; background: var(--meta-panel-bg); overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:18px`. Section labels: `11px/700 var(--meta-label-fg); letter-spacing:.05em; margin-block-end:8px`. Sections, in the export's order:

**TICKET DETAILS** — `PriorityBadge` and `StatusBadge` from Story 04, **reused, not re-styled**. Each is wrapped in a `<button>` opening `AttributePopover`. Then `SlaCard`.

**Create file: `components/thread/AttributePopover.tsx`** — a small listbox anchored to the badge.

- Status choices come from `meta.transitions[ticket.status]` plus the current value shown as selected-and-disabled. **The client never re-derives the graph** — it reads the map the server sends (Backend Task 6).
- Priority choices are all four values from `meta.priorities`.
- Chooses → `PATCH /api/tickets/{ticket}` with the one changed field, via `useTicketAttributeMutation`. On success: invalidate `ticketKeys.all`. **The panel updates and the Activity list gains a row without a reload — that is intake AC 7.**
- **Escape closes it, focus returns to the badge button, and the open state is component state, not a URL parameter.** The queue's New Ticket modal is in the URL because it is a shareable destination; a two-item popover is not.
- A **422** from an illegal transition renders inline under the badge with the server's message. The client's greying-out is a courtesy; **the server is still the authority.**

**Create file: `components/thread/SlaCard.tsx`** — export lines 146–149. Four branches on `ticket.sla.risk`, tinted with `color-mix()` from Story 04's risk tokens (Frontend Task 1):

| `risk` | Label | Value |
|---|---|---|
| `'breached'` | "SLA breached" | the overdue interval |
| `'at_risk'` | "SLA breach in" | `minutes_left` formatted |
| `'ok'` | "SLA due in" | `minutes_left` formatted |
| `null` | "SLA" | **"Not configured"**, `aria-label="SLA not configured"` |

The numeric value carries `dir="ltr"` (RTL export line 139). Add the same comment `SlaCell` carries (Story 04 lines 1172–1176): **do not derive a countdown from `created_at`.**

**ASSIGNED AGENT** — export lines 152–157. Card on `--meta-card-bg` with a `1px solid var(--border-card)` border: a 30px avatar, the assignee's name, and a **Reassign** text button in `var(--nav-active-fg)`. **No job-title line** (Product rules). When `assignee` is `null`, the card reads **"Unassigned"** and the button reads **"Assign"**. Reassign opens Story 03's `Modal` with a `<select>` of `meta.agents` and PATCHes `assigned_to`. A **403** (the actor lacks `assign` on this ticket) renders inline: *"Only the assigned agent or a Team Lead can reassign this ticket."*

**CUSTOMER** — export lines 160–171. Sourced from `useCustomer(ticket.customer.id)` (Frontend Task 3), **not** from `TicketResource.customer`, which is `{id, name}` only.

- 34px avatar + name at `13px/700` + **"Customer since {Mon YYYY}"** from `customer.created_at` via `Intl.DateTimeFormat`.
- A divider (`padding-block-start:6px; border-block-start:1px solid var(--border-card)`) then `email`, `company`, `phone` at `12px var(--text-muted)`, each stacked at `gap:4px`.
- **`email` and `phone` carry `dir="ltr"`** (RTL export lines 158, 160). **Each nullable field is omitted entirely when null** — never rendered as "null", never as an empty row.
- The name links to `/customers/{id}` (Story 03's `CustomerProfilePage`).
- **This card has its own three states.** It is a second request and must not block the thread: render its own small skeleton while loading, and on error render the name from `ticket.customer` with a muted **"Contact details unavailable"** line. **A failed customer fetch never blanks the screen.**

**CLASSIFICATION** — the relabelled TAGS block (Product rules). Two chips at export line 176's geometry (`background: var(--meta-card-bg); color: var(--text-muted); font-size:11px; font-weight:600; border-radius:6px; padding:4px 8px`): `ticket.category_label` and `ticket.channel_label`.

**ACTIVITY** — not in the export; added because intake AC 7 names it (*"the change appears in ticket history … with who changed it and when"*). A compact `<ol>` of the last **10** `ticket_events` from `useTicketEvents`, each one line: the actor's name (or **"Deleted user"**), a rendered sentence, and a relative time with the absolute time as `title`. Render `created`, `status_changed`, `priority_changed`, `category_changed`, `assigned`, `unassigned`, `reopened` and **`replied`** — the eight values that exist after this story. **An unknown `event` value renders its raw string rather than throwing**, so Story 06 and Story 10 can add values without breaking this list.

### 9 — The four states, plus the fifth

Each from its own component, per `brief.md` lines 181–187.

**`ThreadSkeleton.tsx`** — reuses `--skeleton-base` / `--skeleton-sheen` and the `.sk` shimmer rule Story 04 ships (its plan line 961). **The skeleton's geometry matches the real layout**: the same top bar height, the same 300px panel column, and five alternating bubble blocks at the real bubble's `padding` and `gap:16px` — three left, two right. Story 04's rule at its plan line 130 applies verbatim: a skeleton whose shape does not match what replaces it produces the exact layout shift a skeleton exists to prevent. Respects `prefers-reduced-motion`.

**`ThreadEmpty.tsx`** — a ticket with zero messages (created without a description). Centred in the scroll region, built from Story 04's empty-state geometry: a 64px circle in `--meta-card-bg` holding a 30px speech-bubble glyph in `var(--text-muted)`, a `16px/700` heading **"No messages yet"**, and a `13px var(--text-muted)` line **"This ticket was created without a message. Send the first reply to start the thread."** **No button** — the composer directly below is the action, and a button that scrolls to a control already on screen is noise.

**`ThreadError.tsx`** — a non-403 failure on `GET /api/tickets/{id}` or the first message page. Heading **"This conversation could not be loaded"**, a plain-language line, and a **Try again** button calling `refetch()`. **No stack trace, no API URL, no status code in the copy.**

**`ThreadForbidden.tsx`** — the **403** path, intake AC 5. Heading **"You do not have access to this ticket"**; body, for an Agent: *"Ticket #{id} is assigned to another agent. Ask a Team Lead to reassign it, or open your own queue."*; a **Back to Tickets** link. **The reason is authored here, on the client, from the 403 plus the current role** — the API deliberately does not say who owns the ticket (Product rules).

**A 404** — a ticket id that does not exist, or one outside `visibleTo()` that route-model binding never resolved — renders `ThreadForbidden` too, with the neutral heading. **Do not render a distinct "no such ticket" screen**: telling an unauthorised caller which ids exist is the enumeration leak Story 04's bulk endpoint already avoids (its plan line 808).

**Success** — the composed screen.

**And the queue link.** **File: `web/src/features/tickets/components/TicketRow.tsx` — one change.** Wrap the subject text in `<Link to={`/tickets/${ticket.id}`}>`, inheriting colour, with `text-decoration: underline` on hover and focus-visible. **The `<tr>` itself stays non-clickable** — Story 04's line 1153–1156 shape is otherwise unchanged, and a whole-row click handler swallows the checkbox and the badges. The second line (last-updated) stays outside the link.

---

## Edge Cases & Failure Modes

- **A reply of only whitespace.** `"   \n  "` passes a naive `required`. Trimmed in `StoreTicketMessageRequest::prepareForValidation()` (Backend Task 3) **before** validation, and trimmed again by `replySchema` (`model/replySchema.ts`). Both refuse with the identical string **"Write a reply before sending."** Expected: **422** server-side, an inline message client-side, **no row in `ticket_messages`**.
- **A 10 001-character reply.** `max:10000` server-side, `.max(10000)` client-side. Expected: 422 with Laravel's default length message; the draft is preserved and the character overflow is visible. **The textarea is not `maxlength`-capped** — silently truncating a pasted reply loses text without telling anyone.
- **The customer is deleted while the thread is open.** `customer_id` becomes `null` via `nullOnDelete` (Backend Task 1). `TicketMessageResource::authorPayload()` returns `null`, `MessageMeta` renders **"Deleted customer"**, and the panel's `useCustomer` 404s into its own error branch. **The thread still renders.**
- **The assignee is deleted.** `tickets.assigned_to` is `nullOnDelete` (Story 04's contract table), so `TicketResource.assignee` is `null` and `AssignedAgentCard` renders **"Unassigned"**. Past messages from that agent keep `author_type: 'agent'` with a `null` author → **"Deleted user"**.
- **Two agents reply at the same moment.** Both `POST`s succeed; ids are monotonic so the cursor stays consistent. Each client appends only its own `201` body, then `ticketKeys.all` invalidation refetches the newest page and the other reply appears. **No lock and no conflict** — a thread is append-only by nature. Enforced in `TicketMessageController::store()`.
- **A message arrives between two cursor pages.** Cannot corrupt the sequence: the cursor is `id`, monotonic and unique, so a newer row can only ever land on a page the client has already passed. This is the whole reason offset pagination was rejected (Product rules).
- **`next_cursor` is `null` on the first page** — a thread of ≤ 30 messages. `hasNextPage` is `false` and **"Load earlier messages" never renders**. Guard on `hasNextPage`, not on `pages.length`.
- **A prepend while the agent is mid-scroll.** `useThreadScrollAnchor` restores `scrollTop` from the delta in `useLayoutEffect`, **before paint**. Without it the view jumps to the top of the newly-prepended page.
- **The ticket's `channel` is one the composer badge has no icon for.** Impossible today — `Channel` is a closed five-case enum and `ChannelIcon` covers all five (Story 04 lines 1159–1165). If a sixth case is ever added, `ChannelIcon` must fall back to the generic chat glyph rather than rendering an empty `<svg>`. **Add the `default` branch now.**
- **`sla.risk` is `null` for every ticket until Story 06.** `SlaCard` renders the fourth branch. **All four branches ship in this story** so Story 06 changes only the API — this is Story 04's line 1178 rule applied to the panel.
- **`GET /api/customers/{id}` returns 403** because the actor may see the ticket but not the customer record. The panel's customer card falls back to `ticket.customer.name` plus **"Contact details unavailable"**. **The thread is never blocked by the side panel's second request** (Frontend Task 8).
- **A status change to an illegal target.** The popover greys it out from `meta.transitions`; if the client is stale, the server returns **422** and the message renders under the badge. Enforced in Story 04's `TicketController::update()`.
- **`meta.transitions` is missing** because the deployed API predates Backend Task 6. `AttributePopover` falls back to offering **all four statuses** and lets the 422 do the work. **Do not crash on an absent key.**
- **A very long unbroken token in a message body** (a URL, a base64 blob). The bubble sets `overflow-wrap: anywhere` and `min-inline-size: 0`. Without both, one message widens the whole column and the page scrolls horizontally — which `.shell-main`'s `overflow-x:auto` (index.css line 418) would hide behind a scrollbar rather than fix.
- **RTL with a mixed-direction body** — Arabic text containing an English product name, or vice versa. The bubble sets `text-align: start` and **no explicit `direction`**, letting the browser's bidi algorithm run. **Only the clock time, the ticket id, the SLA value, the email and the phone get `dir="ltr"`** — those five, and nothing else.
- **`prefers-reduced-motion: reduce`.** The scroll-to-bottom becomes `behavior: 'auto'` and the skeleton shimmer stops. `brief.md` line 195.
- **A page reload.** The token lives in a module variable (`lib/api.ts` lines 3–6, by ADR-004) so a reload signs the user out and `RequireAuth` sends them to `/login`. **This is intended and unchanged** — do not add a persistence workaround inside this story.
- **Stated uncertainty — the composer's caret API and Story 10.** Story 10's plan (its lines 273–274) explicitly leaves undecided how `QuickReplyPicker` reaches the composer. This story fixes it: **`onInsertAtCaret` and `toolbarSlot`, both on `ReplyComposerProps`** (Frontend Task 7). If Story 10 needs a third seam, it adds a prop; **it does not restructure `ReplyComposer`.**
- **Stated uncertainty — `ChannelIcon`'s size.** Story 04's plan fixes the glyph at 15px (line 1157) without saying whether the size is a prop. If it is hard-coded, add an **optional `size` prop defaulting to 15** — an additive change that leaves the queue's rendering byte-identical. **Do not fork the component.**

---

## Migration / Rollback

- **One new table, no column added to any existing table.** `2026_08_27_120300_create_ticket_messages_table.php` is additive and `down()` drops it cleanly.
- **Half-applied state:** if the migration runs but the code deploy fails, nothing reads or writes `ticket_messages` — the queue, the customers screen and the auth flow are untouched. If the code deploys before the migration, `GET /api/tickets/{id}/messages` 500s and **the detail route is the only broken surface**; the queue keeps working. **Run the migration first.**
- **Rollback:** `php artisan migrate:rollback --step=1` drops `ticket_messages`. The two `TicketController` edits (Backend Task 6) are then **inert but harmful** — `store()` would reference a missing table. **Revert the code with the migration, not separately.**
- **`customers.last_contact_at` is written but never *created* by this story.** Rolling back Story 05 leaves the values in place; they are simply no longer maintained. **No data loss and no backfill needed.**
- **`ticket_events` gains rows with `event = 'replied'`.** Rolling back leaves them; `ActivityList`'s unknown-value fallback and Story 04's own history view both tolerate them. **Do not write a data migration to delete them.**
- **PostgreSQL and SQLite both apply this migration unmodified** — no partial index, no expression index, no `USING`, no driver guard (contrast `2026_08_25_200000_create_audit_logs_table.php` lines 24–26, which needs one).

---

## Test Plan

### Backend — Pest 5, in `api/tests/Feature/`

Follow the assertion style of `api/tests/Feature/Auth/LoginTest.php` lines 16–33 (`assertJsonStructure` + `assertJsonPath`) and the fixture style of `TicketScopeTest.php` lines 10–44.

1. **Create file: `api/tests/Feature/TicketMessageTest.php`**
   1. `it returns a ticket's messages oldest-page-last in one chronological set` — seed 5 messages across `email`, `whatsapp` and `sms`; assert **200**, `data` has 5 entries, and the ids are **descending** (newest first) in the payload. **Asserts the multi-channel AC: every channel is in one list, and no response key groups by channel.**
   2. `it paginates messages by cursor` — seed 45; first call returns 30 and a non-null `meta.next_cursor`; the follow-up with `?cursor=` returns the remaining 15 with a **null** `next_cursor`; assert the two id sets are **disjoint**.
   3. `it locks the message resource shape` — `assertJsonStructure(['data' => [['id','ticket_id','author_type','author','is_mine','channel','channel_label','body','created_at']]])`. **This test is the contract lock for Stories 10 and 13; if it fails, they break.**
   4. `it never exposes an author email` — an agent-authored and a customer-authored message; `assertJsonMissing` on both users' email addresses. Mirrors `TicketScopeTest.php` lines 60–64.
   5. `it forbids reading a thread on someone else's ticket` — an Agent, a ticket assigned elsewhere; **403**.
   6. `it lets a team lead read any thread` — `canSeeTeamQueue()` true; **200**.
   7. `it appends a reply with the ticket's channel and the acting agent` — POST `{body}` to a `whatsapp` ticket; **201**; `assertJsonPath('data.author_type', 'agent')`, `data.channel` is `whatsapp`, `data.is_mine` is `true`.
   8. `it rejects an empty reply` — `{body: ''}` → **422** on `body`; `assertDatabaseCount('ticket_messages', 0)`.
   9. `it rejects a whitespace-only reply` — `{body: "   \n  "}` → **422**, `assertDatabaseCount('ticket_messages', 0)`. **This is the test that catches the trim-after-validate bug.**
   10. `it rejects a reply longer than 10000 characters` — **422**.
   11. `it ignores a client-supplied channel` — POST `{body, channel: 'sms'}` to an `email` ticket; the stored row's channel is **`email`**.
   12. `it bumps the ticket's updated_at` — capture before, travel 1 minute, POST, assert `updated_at` moved.
   13. `it sets the customer's last_contact_at` — `last_contact_at` null before; after the POST it equals the message's `created_at`.
   14. `it never moves last_contact_at backwards` — set `last_contact_at` to a future timestamp, POST, assert **unchanged**.
   15. `it writes exactly one replied event and nothing to audit_logs` — `assertDatabaseHas('ticket_events', ['event' => 'replied', 'user_id' => $agent->id])` and `assertDatabaseCount('audit_logs', 0)`.
   16. `it forbids replying to someone else's ticket` — **403**, `assertDatabaseCount('ticket_messages', 0)`.
   17. `it creates the opening message from a ticket description` — `POST /api/tickets` with a description; assert one `ticket_messages` row with `author_type` `customer` and the description as `body`. **Covers Backend Task 6's first edit.**
   18. `it creates no message when a ticket has no description` — `assertDatabaseCount('ticket_messages', 0)`.
2. **File: `api/tests/Feature/ApiContractTest.php` — extend.** Add a case asserting `GET /api/tickets/meta` now returns a `transitions` key whose `open` entry contains `pending`, `resolved` and `closed` and **does not contain `open`**. **Do not modify the existing cases.**
3. **File: `api/tests/Feature/TicketScopeTest.php` — do not modify.** Its two `it(...)` blocks (lines 46 and 67) must pass with their assertions unchanged after this story.

### Frontend — Vitest + Testing Library, in `web/src/features/tickets/`

Copy the mocking pattern from `web/src/app/navigation/navRoutes.test.tsx` lines 13–60: `vi.mock('../../lib/api')` spreading `importActual`, a `makeUser()` factory, and a `SignedInAs` wrapper driving a real `login()`. **Do not hand-mock `useAuth`.**

4. **`components/thread/MessageList.test.tsx`** — given two pages of mixed-channel messages, the rendered `<li>` order is **oldest → newest** and matches a hand-written expected id sequence. **This is the test for the reverse-then-concatenate rule; write it before the component.**
5. **`components/thread/MessageList.test.tsx`** — with `hasNextPage: false`, **"Load earlier messages" is absent**; with it `true`, the button renders and clicking it calls `fetchNextPage` once.
6. **`components/thread/MessageBubble.test.tsx`** — an `agent` message and an `is_mine: false` `agent` message both render outbound; a `customer` message renders inbound. **Asserts alignment follows `author_type`, not `is_mine`.**
7. **`components/thread/MessageBubble.test.tsx`** — a body containing `<img src=x onerror=alert(1)>` renders as **text**; `container.querySelector('img')` is `null`.
8. **`components/thread/ReplyComposer.test.tsx`** — typing then submitting calls `sendMessage` with the trimmed body; **on success the textarea is empty**.
9. **`components/thread/ReplyComposer.test.tsx`** — with `sendMessage` rejecting, **the textarea still holds the typed text**, a `role="alert"` is present, and **Retry** re-calls `sendMessage` with the same string. **This is intake AC 9.**
10. **`components/thread/ReplyComposer.test.tsx`** — submitting `"   "` shows **"Write a reply before sending."** and `sendMessage` is **never called**.
11. **`components/thread/TicketMetaPanel.test.tsx`** — with `sla.risk: null` the card reads **"Not configured"**; with `'breached'` it renders the breached label. **Both branches, so Story 06 has a regression net.**
12. **`components/thread/TicketMetaPanel.test.tsx`** — a failing `useCustomer` still renders the customer's name and **"Contact details unavailable"**; the message list is still in the document.
13. **`pages/TicketDetailPage.test.tsx`** — a **403** from `GET /api/tickets/{id}` renders `ThreadForbidden` with the specific copy and a **Back to Tickets** link, and **no** raw status code. **Intake AC 5.**
14. **`pages/TicketDetailPage.test.tsx`** — the loading state renders `ThreadSkeleton`, never an empty frame. **Intake AC 6.**
15. **`pages/TicketDetailPage.test.tsx`** — rendered under `dir="rtl"`, the message `<li>` order is **unchanged**. **Intake AC 8: chronology does not follow direction.**
16. **`components/TicketRow.test.tsx` — extend Story 04's file.** The subject renders a link to `/tickets/{id}`; the `<tr>` still has no click handler.

---

## Verification Steps

1. **Backend migrates on both drivers:** in `api/`, `php artisan migrate` against the configured PostgreSQL connection, then `php artisan migrate:fresh --env=testing` to exercise SQLite. **Both must succeed with no driver guard.**
2. **Backend tests:** in `api/`, `php artisan test`. **Fully green**, including the untouched `TicketScopeTest.php`.
3. **Routes registered:** in `api/`, `php artisan route:list --path=tickets`. Confirm **nine** ticket routes and that `/tickets/meta` still precedes `/tickets/{ticket}`.
4. **Frontend tests:** in `web/`, `npx vitest run`. **There is no `test` script in `web/package.json` — do not add one.**
5. **Frontend lint and build:** in `web/`, `npm run lint` (oxlint) and `npm run build` (`tsc -b && vite build`). Both clean.
6. **Frontend runs:** in `web/`, `npm run dev`. Sign in, open `/tickets`, click a subject, and verify by hand:
   - The thread loads with a skeleton, then a mixed-channel list, scrolled to the newest message.
   - **"Load earlier messages"** on the seeded 30+ thread prepends without moving the reading position.
   - Sending a reply appends it, clears the composer, and updates the queue row's last-updated on going back.
   - Killing the API mid-send leaves the draft intact and shows **Retry**.
   - Changing status from the panel adds a row to **ACTIVITY** without a reload.
7. **Regression — theme:** toggle the header's theme control and confirm every new token resolves in **all four** blocks. A token missing from `[data-theme="light"]` shows only when an explicit light choice is made on a dark OS.
8. **Regression — RTL:** switch direction and confirm the panel is on the visual **left**, bubble tails mirror, the Send arrow and the back chevron mirror, `#4821` reads `#4821`, and times/emails/phones stay LTR.
9. **Regression — responsive:** at 375px the panel stacks **above** the thread, the page never scrolls horizontally, and the composer stays reachable.
10. **Regression — accessibility:** tab through the screen. Every interactive element has a visible focus ring; no `outline: none` without a replacement was introduced; the list announces as a list; the newest message is announced once.

---

## Shared contracts this story establishes

**Stories 06, 09, 10 and 13 cite this section verbatim. Nothing below may be redefined in a later plan.**

### `ticket_messages` — the message timeline

Table created by `api/database/migrations/2026_08_27_120300_create_ticket_messages_table.php`. Model **`App\Models\TicketMessage`**. Resource **`App\Http\Resources\TicketMessageResource`**. Controller **`App\Http\Controllers\TicketMessageController`**.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | bigint PK | no | **The cursor-pagination key.** Monotonic; never reused. |
| `ticket_id` | FK → `tickets` | no | `cascadeOnDelete`. |
| `author_type` | string(16) | no | Closed set `customer` \| `agent` \| `system`, validated against `TicketMessage::AUTHOR_TYPES`. **Deliberately not an `App\Enums` enum.** |
| `user_id` | FK → `users` | **yes** | `nullOnDelete`. Set only when `author_type = 'agent'`. |
| `customer_id` | FK → `customers` | **yes** | `nullOnDelete`. Set only when `author_type = 'customer'`. |
| `channel` | string(16) | no | Cast to `App\Enums\Channel`. **Copied from `tickets.channel` on write; never client-supplied.** |
| `body` | text | no | Plain text. **Rendered as text, never as HTML.** |
| `created_at` / `updated_at` | timestamps | no | **Full `timestamps()`, unlike `ticket_events`.** Messages are content, not audit. |

Indexes: `(ticket_id, id)` · `(ticket_id, created_at)`. **Valid on PostgreSQL and SQLite with no driver guard.**

- **Story 10 adds `visibility` (string, NOT NULL, default `public`) in its own migration.** This story's migration is **not edited**.
- **Story 13 writes rows with `author_type = 'system'`.** Nothing in Story 05 writes that value; it is reserved here so the discriminator does not have to change later.
- **No `attachments`, no `remote_message_id`, no `visibility`, no `edited_at` in this story.** A later Integrations story adds provider ids together with the provider.

### `TicketMessageResource` JSON shape

```jsonc
{
  "id": 918,
  "ticket_id": 4821,
  "author_type": "customer",                                  // customer | agent | system
  "author": { "id": 12, "name": "Amelia Chen", "initials": "AC" },  // nullable; NEVER carries email, phone or role
  "is_mine": false,                                           // agent messages authored by the requesting user
  "channel": "whatsapp",  "channel_label": "WhatsApp",
  "body": "Got the new link, thanks!",
  "created_at": "2026-08-22T08:15:00.000000Z"
}
```

- **`author` is `null`** for a system message and for a message whose author row was deleted. `author_type` still says which kind it was.
- **`is_mine` drives only the `(You)` suffix. Bubble alignment is driven by `author_type === 'agent'`.**
- Collections come back in Laravel's **cursor** envelope — `{ data, links, meta }` where `meta` carries `path`, `per_page`, `next_cursor`, `prev_cursor`. **There is no `total` and no `last_page`.** This is *not* the `Paginated<T>` shape Story 04's queue uses.

### API surface added (behind `auth:sanctum`)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/tickets/{ticket}/messages` | Cursor-paginated, **fixed 30 per page**, ordered `id DESC`. `?cursor=` only — **`per_page` is not accepted.** Gated by `TicketPolicy::view`. |
| `POST` | `/api/tickets/{ticket}/messages` | Body `{ body: string }` **and nothing else**. Returns **201** with the created message. Gated by `TicketPolicy::update`. |

**Additive change to an existing endpoint:** `GET /api/tickets/meta` gains a **`transitions`** key — `Record<TicketStatus, TicketStatus[]>` from `TicketStatus::allowedTransitions()`. **No existing key is renamed, reshaped or removed.**

### `ticket_events` — one new `event` value

**`replied`** — written on every successful reply. `user_id` = the acting agent, `field` = `null`, `old_value` = `null`, `new_value` = the message id **as a string**. **No second history table, and nothing written to `audit_logs`.**

### `customers.last_contact_at` — owned write

**This story is the only writer.** Set to the message's `created_at` inside `TicketMessageController::store()`'s transaction, and **only when the new value is later than the stored one** (`whereNull(...)->orWhere('<', …)` in a single statement). **Never moves backwards.** Story 03 declares, seeds and displays the column; it does not write it at runtime.

### Frontend

- **The thread lives in `web/src/features/tickets/`.** There is **no** `web/src/features/conversation-thread/` folder. `features/tickets/index.ts` exports **`TicketQueuePage`** and **`TicketDetailPage`**, and nothing else.
- **`ticketKeys.messages(id)`** joins Story 04's key factory under `ticketKeys.all`. **Every mutation on this screen invalidates `ticketKeys.all`.**
- **`ReplyComposerProps` is the mount contract for Stories 09 and 10** and is frozen here:
  - `onInsertAtCaret?: (text: string) => void` — implemented in this story; splices at `selectionStart` and restores the caret. **Story 09 supplies the string; the format `[<title>](/knowledge-base/<slug>)` is Story 09's, defined in its own plan (lines 152–153), not here.**
  - `toolbarSlot?: React.ReactNode` — rendered between the channel badge and the input card. **Story 10 fills it with `QuickReplyPicker` and the internal-note toggle.**
  - **Neither story restructures `ReplyComposer.tsx`.**
- **`<div className="thread-assist-slot" />`** is the AI-assist mount point, first child of the composer. **It renders `null` in this story — no pill, no disabled control, no "Coming soon" text.** A future AI story fills this node and moves no other element.
- **`web/src/features/customers/index.ts` gains `useCustomer` and `customerKeys`** — additive; no existing export changes.
- New tokens `--msg-*`, `--thread-*`, `--meta-*`, `--composer-placeholder` live in `web/src/index.css` in **all four** blocks and are **reused, not redefined**, by Stories 10 and 13. **The SLA card has no tokens of its own** — it derives its tint from Story 04's `--sla-*` with `color-mix()`.
- **`PriorityBadge`, `StatusBadge`, `SlaCell` and `ChannelIcon` are Story 04's.** This story reuses them and adds at most an **optional `size` prop** to `ChannelIcon`. **It does not re-style or fork any of the four.**

---

## Done Criteria

- [ ] `/tickets/{id}` renders the real conversation thread; a queue row's **subject** links to it and the `<tr>` still has no click handler.
      <!-- plan-review 2026-08-28: ⚠️ code present (TicketRow.tsx:48 <Link to=/tickets/{id}>,
           App.tsx:53 route) but Test Plan #16 is missing: no components/TicketRow.test.tsx and no
           href assertion anywhere in TicketTable.test.tsx. -->
- [x] `ticket_messages` exists with exactly the columns pinned above, both indexes, and **no `visibility` column**; the migration applies unmodified on **PostgreSQL and SQLite** with no driver guard.
- [x] Messages from every channel render in **one chronological list**, oldest at the top, with **no channel grouping, tab, or filter anywhere on the screen** — asserted by a test, not by inspection.
- [x] `TicketMessageResource` matches the pinned JSON shape exactly, and **never** exposes an author's email, phone or role — locked by a structure test and a `assertJsonMissing` test.
- [x] `GET /api/tickets/{ticket}/messages` is **cursor**-paginated at a fixed 30, rejects nothing but is not widenable by `per_page`, and a two-page fetch returns **disjoint** id sets.
- [ ] "Load earlier messages" prepends older messages and **the reading position does not move**; it is absent when `hasNextPage` is false.
      <!-- plan-review 2026-08-28: ⚠️ absent/present + fetchNextPage-once is implemented
           (MessageList.tsx:51,59) AND tested (MessageList.test.tsx:30-52). The
           "reading position does not move" half is implemented (useThreadScrollAnchor.ts:43-57,
           useLayoutEffect) but unverified — the plan itself (line 108) notes jsdom cannot test
           it, and Verification Step 6's manual check was not run. -->
- [x] An empty or whitespace-only reply is refused **client- and server-side with the same wording**, and `ticket_messages` gains no row.
- [x] A failed send **preserves the drafted text**, keeps focus, shows a `role="alert"` error, and **Retry** re-sends the same string. No optimistic bubble is ever rendered.
- [x] A successful reply is stored with the **ticket's** channel (a client-supplied `channel` is ignored), bumps `tickets.updated_at`, writes **one** `ticket_events` row with `event = 'replied'`, and writes **nothing** to `audit_logs`.
- [x] `customers.last_contact_at` is set from the reply's timestamp and **never moves backwards** — both directions asserted by tests.
- [x] `POST /api/tickets` with a description creates the **opening customer message**; without one it creates no message.
- [x] `GET /api/tickets/meta` returns `transitions`, and **every pre-existing key in that response is byte-for-byte what Story 04 shipped**.
- [x] The side panel shows priority, status, the SLA card, the assigned agent, customer contact detail, and the classification chips, and **stays fixed while the message list scrolls independently** — two scroll regions, one page that does not scroll.
- [x] The SLA card renders **all four** `sla.risk` branches and shows **"Not configured"** today; **no countdown is derived from `created_at`.**
- [x] Changing status, priority or assignee from the panel goes through Story 04's `PATCH /api/tickets/{ticket}`; the change appears in **ACTIVITY** without a reload; an illegal transition surfaces the server's 422 inline.
- [x] `TicketPolicy` is **unedited**; a 403 renders `ThreadForbidden` with a **specific** reason and no status code, and a nonexistent id renders the same screen rather than confirming the id does not exist.
- [x] All four states ship from their own components, plus the Forbidden state; the skeleton's geometry matches the real layout and respects `prefers-reduced-motion`.
      <!-- plan-review 2026-08-28: ✅ four named components — ThreadStates.tsx:3 (Skeleton), :30
           (Empty), :46 (Error), :58 (Forbidden); reduced motion via index.css:727
           (.sk { animation: none }). Layout deviation, not a criterion failure: the four live in
           one ThreadStates.tsx rather than the four separate files the file tree (line 418)
           lists. -->
- [x] A message body containing HTML renders as **text** — no `dangerouslySetInnerHTML` anywhere in this story.
- [x] The AI-suggested-reply affordance **is not rendered**: `thread-assist-slot` returns `null`, and the screen contains no "Suggested", no "Use", no "Dismiss" and no "Coming soon".
- [x] The composer's channel control is a **read-only indicator with no chevron**, and `POST` accepts no `channel`.
- [x] Under RTL the panel is on the visual left, bubble tails mirror via **logical** radius properties, the Send arrow and back chevron **swap paths** (no `scaleX(-1)`), and the message order is **unchanged** — asserted by a test.
- [x] Every new token is declared in **all four** blocks of `web/src/index.css`; no Story 04 token is redefined.
- [ ] Below 1024px the panel stacks **above** the thread and the page never scrolls horizontally from 375px up.
      <!-- plan-review 2026-08-28: ⚠️ stacking implemented (index.css:2303-2308 —
           .thread-split{flex-direction:column} + .meta-panel{order:-1}) and long-token overflow
           guarded (index.css:2091 overflow-wrap:anywhere). The "never scrolls horizontally from
           375px" half has no test and Verification Step 9's manual check was not run. -->
- [ ] `web/src/features/tickets/index.ts` exports exactly `TicketQueuePage` and `TicketDetailPage`; **no `features/conversation-thread/` folder exists**; `navItems.tsx` is unchanged and `navRoutes.test.tsx` passes untouched.
      <!-- plan-review 2026-08-28: 🔀 BROKEN BY STORY 07, not by Story 05. index.ts:7-9 now also
           exports PriorityBadge, SlaCell and four types, against the contract at line 901
           ("and nothing else"). The rest of the criterion holds: no features/conversation-thread/
           folder, navItems.tsx unchanged (empty git diff), navRoutes.test.tsx passes. -->
- [ ] `npx vitest run` and `php artisan test` are both fully green; `npm run build` and `npm run lint` are clean.
      <!-- plan-review 2026-08-28: ❌ pest = 153 tests / 143 passed / 10 FAILED. All ten are
           Customer* (CustomerResource.php:20 "Attempt to read property value on null"):
           CustomerCrudTest x3, CustomerDuplicateTest x4, CustomerAttachmentTest, CustomerListTest,
           CustomerPolicyTest — Story 03's surface, not Story 05's. Story 05's own suites are
           green: TicketMessageTest + ApiContractTest + TicketScopeTest = 27/27.
           vitest 155/155 pass, build succeeds, lint clean. -->
- [x] `.squad/plans/conversation-thread/00-overview.md` records the Story 05 row and its dependency notes.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 06.**
