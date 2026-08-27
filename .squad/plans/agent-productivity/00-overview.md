# agent-productivity — plan overview

Entry point for the **agent-productivity** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 10 | [10-story-agent-productivity.md](10-story-agent-productivity.md) | Agent Productivity — Quick Replies, Tasks & Internal Collaboration | WIS-12 | Stories 01, 02, 04, 05, 06, 11 |

## Dependency notes

**Plan status: contract-level (skeleton).** Story 10 executes after Story 09 against code that does
not exist yet. Its scope, contracts, and acceptance criteria are final; task-level file paths and
line ranges are deliberately absent and must be filled in by regenerating the plan at full depth
immediately before implementation.

- **Depends on** [`../conversation-thread/05-story-conversation-thread.md`](../conversation-thread/05-story-conversation-thread.md):
  Story 05 owns the `ticket_messages` table, the chronological thread, and the reply composer.
  Story 10 **attaches** to them — it adds a `visibility` column via its own migration, adds a
  composer mode and a quick-reply picker, and never edits Story 05's migration or creates a second
  message table. One chronological thread is a hard requirement of Story 05 and of the design brief.
- **Depends on** [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md):
  the `tickets` table, the `TicketStatus` enum, the ticket-close transition Story 10 hooks, and the
  ticket-history mechanism a mention writes into. Consumed, never redefined.
- **Depends on** [`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md):
  task reminders reuse Story 06's queue and scheduler infrastructure. **No second scheduling
  mechanism is introduced.**
- **Depends on** [`../notifications/11-story-notifications-centre.md`](../notifications/11-story-notifications-centre.md):
  Story 10 is a **producer** of the `mention` and `task_due` notification types. It displays
  nothing itself; Story 11 owns the table, the enum registry, and the dispatcher.
- **Feeds** [`../agent-dashboard/07-story-agent-dashboard.md`](../agent-dashboard/07-story-agent-dashboard.md):
  the Agent Dashboard already lists "quick-reply shortcuts" and a tasks surface in its acceptance
  criteria. Build Story 10 before or alongside Story 07, never after.
- **Shared contracts this story establishes**, which later stories consume rather than redefine:
  - Tables `quick_replies`, `ticket_tasks`, `ticket_message_mentions`, and the `visibility` column
    on Story 05's `ticket_messages`.
  - Enums `MessageVisibility` (`public`/`internal`), `TaskStatus`, `QuickReplyStatus` in
    `api/app/Enums/`.
  - `GET /api/tasks?assignee=me&status=open` — the exact contract Story 07's dashboard consumes.
  - The quick-reply placeholder vocabulary (`{{customer.first_name}}`, `{{ticket.id}}`, …) and the
    **echo-literal-on-unresolvable** rule, owned by `App\Services\QuickReplyRenderer`.
  - `web/src/features/agent-productivity/index.ts` exporting `QuickReplyPicker`,
    `TicketTasksPanel`, `useMyOpenTasks`, `QuickRepliesPage` — the only public surface.
- **Two ownership questions the plan decides explicitly**, rather than leaving implicit:
  quick replies are a **shared team library only** (no personal agent scope; no `scope` column), and
  closing a ticket with open tasks **warns then auto-cancels** them, so an orphaned reminder is
  impossible by construction.
- **New route and nav entry:** `/quick-replies`, added to
  `web/src/app/navigation/navItems.tsx` with `group: 'admin'` and restricted to Team Lead and
  Administrator. The route guard mirrors the existing `/sla-rules` pattern; the policy is the gate.
