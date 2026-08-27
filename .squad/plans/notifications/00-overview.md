# notifications — plan overview

Entry point for the **notifications** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 11 | [11-story-notifications-centre.md](11-story-notifications-centre.md) | Notifications Centre (in-app) | WIS-13 | Stories 01, 02, 04, 06, 08, 10 |

## Dependency notes

**Plan status: contract-level (skeleton).** Story 11 executes after Story 10 against code that does
not exist yet. Its scope, contracts, and acceptance criteria are final; task-level file paths and
line ranges are deliberately absent and must be filled in by regenerating the plan at full depth
immediately before implementation.

- **Depends on** [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md):
  **Story 02 shipped the header bell slot inert and named WIS-13 as its owner** — a disabled
  `shell-icon-btn` with `title="Coming soon"`, an `aria-label="Notifications"`, an `aria-hidden`
  `shell-notification-dot`, and a comment pointing here. **Story 11 fills that slot and must not
  restructure the header.** Only the button and its dot change; the Language slot beside it
  (Story 15), the search block, the New Ticket button, and the user menu are untouched. The
  existing `AppLayout` test is **extended** as the regression guard on that constraint, not
  replaced.
- **Producers** — Story 11 displays; it does not generate.
  [`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md)
  emits `sla_at_risk` and `sla_breached`;
  [`../agent-productivity/10-story-agent-productivity.md`](../agent-productivity/10-story-agent-productivity.md)
  emits `mention` and `task_due`. Both call this story's dispatcher; neither writes the table
  directly.
- **Buildable with Story 06 alone.** If Story 10 slips, Story 11 ships against the SLA producer
  only: `type` is an **open string column** backed by a PHP enum registry, so Story 10's types drop
  in with **no schema change**.
- **Depends on** [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md):
  `TicketPolicy` decides whether a notification's source record is still visible to its recipient —
  the basis of the `source_available` flag. Consumed, never redefined.
- **Depends on** [`../users-roles-admin/08-story-users-roles-administration.md`](../users-roles-admin/08-story-users-roles-administration.md):
  the dispatcher drops delivery to a deactivated account.
- **Shared contracts this story establishes**, which producers and later stories consume rather
  than redefine:
  - The `notifications` table, indexed on `(user_id, read_at)` — the unread-count query runs on
    every page load for every user.
  - `App\Enums\NotificationType` — the canonical registry (`sla_at_risk`, `sla_breached`,
    `mention`, `task_due`). **API `type` values are product domain events; framework class names
    never leak into the contract.**
  - `App\Services\NotificationDispatcher::dispatch(...)` — the **only** write path, with the
    deactivated-recipient guard inside it.
  - `GET /api/notifications`, `GET /api/notifications/unread-count`,
    `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all` — all caller-scoped,
    the two mark actions idempotent.
  - `NotificationResource.source_available` — the flag that produces the "no longer available"
    state without ever letting the client follow a link into a 403/404.
  - `web/src/features/notifications/index.ts` exporting `NotificationBell`, `useUnreadCount`,
    `NotificationsPage` — the only public surface. `AppLayout.tsx` imports `NotificationBell` alone.
- **Two decisions the plan makes explicitly**, rather than leaving as omissions: delivery is
  **polling, not WebSocket push** (persistence-first is what makes that sufficient), and storage is
  a **first-class domain table**, not Laravel's built-in polymorphic notifications table.
- **New route, no nav entry:** `/notifications` is reached from the panel's "View all
  notifications" link, matching the design export. `navItems.tsx` is **not** modified.
