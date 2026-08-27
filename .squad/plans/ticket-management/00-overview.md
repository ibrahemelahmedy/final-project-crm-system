# ticket-management — plan overview

Entry point for the **ticket-management** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 04 | [04-story-ticket-management-queue.md](04-story-ticket-management-queue.md) | Ticket Management (Queue) | WIS-2 | Story 03 (customer-management) |

## Dependency notes

**This is the core entity story — eight later stories read or write through what it
establishes.** It lands after Story 03 because `tickets.customer_id` is **NOT NULL** with
`restrictOnDelete`, so the `customers` table must exist first.

- **Depends on** [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md):
  Story 03 owns the `customers` table, `Customer` model and `CustomerResource`. This story adds
  `customer_id` in **its own** migration and adds `Customer::tickets()`; it never defines a
  customer column. Story 03's `CustomerResource.open_tickets_count` sits behind a
  `Schema::hasColumn('tickets','customer_id')` guard returning `0` until this story lands — this
  story swaps that literal for the `TicketStatus` enum **without renaming the key**.
- **Depends on** [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md)
  and [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md),
  both **implemented and committed**. The existing minimal `tickets` scaffold
  (`api/database/migrations/2026_08_25_200001_create_tickets_table.php`) is **expanded by a new
  migration, never edited**, and `api/tests/Feature/TicketScopeTest.php` must stay green.

### Shared contracts this story establishes

Recorded in full in the story file's **"Shared contracts this story establishes"** section, which
later plans cite verbatim rather than redefining:

- **Enums** `Priority`, `TicketStatus`, `Channel` in `api/app/Enums/`, with
  `TicketStatus::allowedTransitions()` as the sole transition authority. `category` is
  deliberately **not** an enum — a `string(32)` against `Ticket::CATEGORIES`.
- **`ticket_events`** — the one append-only ticket-history table. Later stories append new `event`
  values; they do **not** create a second history table, and they do **not** write ticket
  lifecycle changes into Story 01's `audit_logs`.
- **`TicketResource` JSON shape**, including the fixed `sla: { due_at, minutes_left, risk }` block.
  **Story 06 fills those values and never changes those keys.**
- **API surface** `GET|POST /api/tickets`, `/api/tickets/meta`, `/api/tickets/bulk`,
  `GET|PATCH /api/tickets/{ticket}`, `GET /api/tickets/{ticket}/events`.
- **Frontend** `web/src/features/tickets/` exporting `TicketQueuePage` only; `ticketKeys` as the
  one keying scheme (stories 05, 06, 07, 11, 12, 13 nest under `ticketKeys.all`); URL-held filter
  and pagination state as the pattern every later list screen follows; `PriorityBadge` and
  `StatusBadge` as **two** components with two token sets.

### Reserved for later stories — not implemented here

- `first_response_due_at` / `resolution_due_at` and the SLA-risk computation →
  [`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md).
  This story ships the SLA column and its tokens with a `null` value.
- The message timeline inside a ticket →
  [`../conversation-thread/05-story-conversation-thread.md`](../conversation-thread/05-story-conversation-thread.md).
- Real inbound-channel ingestion — `channel` is a static enum here.

## Carried-forward debt from Story 01 (authentication)

`Ticket::scopeVisibleTo()` (`api/app/Models/Ticket.php`) implements Team Lead / Administrator
visibility as "all tickets" because no `teams` table exists yet. **Story 04 does not resolve
this** — it introduces no `teams` table. The debt now belongs to
[`../users-roles-admin/08-story-users-roles-administration.md`](../users-roles-admin/08-story-users-roles-administration.md),
which must narrow that branch to the Team Lead's own team — see the comment on
`canSeeTeamQueue()` in the same file.
