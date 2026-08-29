# agent-productivity — plan overview

Entry point for the **agent-productivity** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 10 | [10-story-agent-productivity.md](10-story-agent-productivity.md) | Agent Productivity — Quick Replies, Tasks & Internal Collaboration | WIS-12 | Stories 01, 02, 04, 05, 06, 11 |

## Dependency notes

**Plan status: implemented (2026-08-28).** Backend: `quick_replies`, `ticket_tasks`,
`ticket_message_mentions` tables, the `visibility` column on `ticket_messages`, `MessageVisibility` /
`TaskStatus` / `QuickReplyStatus` enums, `QuickReplyRenderer`, `MentionResolver`,
`tasks:dispatch-due-reminders` (scheduled every 5 minutes in `routes/console.php`), the ticket-close
task-cancellation hook, and every endpoint in the plan's contract table — all backed by Pest tests
(`QuickReplyTest`, `QuickReplyRendererTest`, `TicketTaskTest`, `TaskReminderTest`,
`TicketCloseCancelsTasksTest`, `InternalNoteVisibilityTest`, `MentionAuthorizationTest`, 23/23
green). Frontend: `web/src/features/agent-productivity/` (picker, tasks panel, admin library page,
the internal-note composer mode + `@mention` autocomplete added to Story 05's `ReplyComposer`), the
`/quick-replies` route and nav entry, and Vitest coverage for all three required components
(14/14 green). Story 11 (Notifications Centre) landed concurrently in this same session window;
Story 10 consumes its `NotificationDispatcher`/`NotificationType`/`notifications` table as the
producer this plan specifies, with no redefinition on either side.

One documented deviation from the "only four public exports" contract: the public index also
exports `useOpenTaskCount`, a small hook Story 05's `TicketMetaPanel` needs to show the
"N open task(s) will be cancelled" warning *before* the close PATCH fires — see
`web/src/features/agent-productivity/hooks/useOpenTaskCount.ts` for the rationale. Everything else
in the plan's public-surface contract is unchanged.

**Manual browser QA (2026-08-28, against the live Vite/artisan-serve stack)** caught and fixed two
real bugs the automated suites didn't surface: (1) wrapping `<textarea>` in `.composer-textarea-wrap`
for the mention panel's anchor dropped its flex-stretch width — fixed with explicit `inline-size:
100%` on both; (2) closing a ticket with open tasks cancelled them server-side but left the Tasks
panel showing them as open, because it lives in a separate TanStack Query namespace from
`ticketKeys` — fixed by having `useTicketAttributeMutation` also invalidate the `['tasks']` key
prefix on success. Both were re-verified live (quick-reply insert at full composer width; the
Tasks panel showing the cancelled task strikethrough immediately after confirming close) before
this story was called done.

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
