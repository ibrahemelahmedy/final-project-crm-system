# sla-rules-automation — plan overview

Entry point for the **sla-rules-automation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 06 | [06-story-sla-rules-automation.md](06-story-sla-rules-automation.md) | SLA Rules & Automation | WIS-6 | Story 04 (ticket-management) |

## Dependency notes

**This story makes the SLA-risk indicator real.** Story 04 shipped the queue's SLA column, its four
design tokens, and a fixed-shape `sla` object that is `null` for every ticket. This story fills it.

- **Depends on** [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md).
  Read its **`## Shared contracts this story establishes`** section (from line 1463) before executing
  anything here. Story 04 owns the `tickets` core columns, the `Priority` / `TicketStatus` / `Channel`
  enums, and `ticket_events`. This story:
  - adds `first_response_due_at` and `resolution_due_at` — **plus nine more SLA columns** — in **its own**
    migration, which Story 04 explicitly deferred;
  - **fills** `TicketResource`'s fixed `sla: { due_at, minutes_left, risk }` block **without changing a
    key**, because `SlaCell.tsx` is already written against all four `risk` cases;
  - appends `auto_assigned`, `escalated` and `auto_closed` to **`ticket_events`** — it creates no second
    history table and writes nothing into Story 01's `audit_logs`;
  - routes every transition through `TicketStatus::allowedTransitions()` and every priority ordering
    through `Priority::sortExpression()`. **No parallel logic.**
- **Depends on** [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md),
  implemented and committed. It created the `/sla-rules` placeholder route this story replaces.
  **No `navItems.tsx` edit is required** — the `SLA Rules` entry already exists under `group: 'admin'`
  with `roles: ['administrator']`, and `App.tsx` already wraps the route in
  `RequireAuth roles={['administrator']}`. Only the route's `element` changes.

### Shared contracts this story establishes

Recorded in full in the story file's **"Shared contracts this story establishes"** section, which later
plans cite verbatim rather than redefining:

- **`sla_rules`** — one rule per priority tier (`priority` is **unique**): response and resolution
  targets in minutes, an at-risk threshold percentage, escalation settings, and an auto-close window.
  Administrator-only CRUD at `GET|POST /api/sla-rules` and `PATCH|DELETE /api/sla-rules/{sla_rule}`.
- **Eleven `tickets` columns**, including `first_response_due_at`, `resolution_due_at`, `sla_at_risk_at`,
  `escalate_at`, the Pending-clock pause pair, two once-only notification guards, and **`escalated_at`**.
- **The due-date computation**, pinned as a formula. Every due date is an **absolute timestamp written at
  ticket creation** — nothing is re-derived from `sla_rules` at read time, which is the *mechanism*
  (not the convention) behind "a rule edit applies going forward only".
- **`App\Services\SlaClock`** — the single source of SLA-risk computation, registered as a singleton.
  `snapshot()`, `riskFor()`, `minutesLeft()` and `complianceBetween()` are the only entry points; no
  screen, widget, report or job reimplements a threshold. `snapshot()` issues **no query**.
- **`Ticket::slaRunning()` / `slaBreached()` / `slaAtRisk()` / `slaUrgencyOrder()`** — the only correct
  SLA selectors, written to be valid on **both** PostgreSQL (runtime) and SQLite (tests).
- **`App\Services\TicketAssigner`** — least-open-load auto-assignment with a round-robin tiebreak,
  taking over the `assigned_to`-null branch Story 04 deliberately left open in `TicketController@store`.
- **`php artisan sla:evaluate`** — the escalation, breach and auto-close engine, scheduled every five
  minutes from `api/routes/console.php`. It runs **synchronously**: `QUEUE_CONNECTION=database` with no
  worker configured anywhere in this repo means a dispatched job would never execute.
- **`App\Services\SlaNotifier`** — the seam to Story 11, emitting `sla_at_risk` / `sla_breached` through
  `NotificationDispatcher` when it exists and logging when it does not.

### What later stories consume, and where they must adjust

- [`../agent-dashboard/07-story-agent-dashboard.md`](../agent-dashboard/07-story-agent-dashboard.md) —
  its SLA widgets call `SlaClock`, and its queue ordering uses `Ticket::slaUrgencyOrder()`.
  **Its stated uncertainty at lines 207–209 ("whether escalation is a status, a flag, or an event —
  decided by Story 04") is resolved here, not by Story 04**, which ships no escalation concept:
  escalated means `tickets.escalated_at IS NOT NULL`, plus an `escalated` row in `ticket_events`.
  **Story 07 must render `escalated_by_name` as "SLA automation"** — escalations are engine-written, so
  the history row's `user_id` is null. Its instruction not to add the column *in its own plan* still
  holds; the column lands here.
- [`../notifications/11-story-notifications-centre.md`](../notifications/11-story-notifications-centre.md) —
  no conflict. Its `NotificationType` values `sla_at_risk` / `sla_breached` and its
  `NotificationDispatcher::dispatch()` signature are matched positionally by `SlaNotifier`, behind a
  `class_exists` guard, so Story 11 lands without changing a line of engine code.
- [`../reports-dashboards/12-story-reports-dashboards.md`](../reports-dashboards/12-story-reports-dashboards.md) —
  its stated uncertainty at lines 277–284 is resolved by `SlaClock::complianceBetween($from, $to)`,
  which returns `compliance_rate`, `breach_rate`, `avg_resolution_minutes` and `resolved_count`, with
  **null rates (never `0`) on an empty window**. `first_response_at` supplies its `avg_response_minutes`.
- [`../conversation-thread/05-story-conversation-thread.md`](../conversation-thread/05-story-conversation-thread.md) —
  the SLA countdown in its side panel reads `TicketResource.sla`, unchanged in shape. Story 05 adds the
  **second and earlier** caller of `SlaClock::markFirstResponse()` (the first outbound message); the
  method is idempotent, so that addition needs no change here.

### Deliberate deviations from the design export

- The Low card's `1 business day` / `5 business days` ship as **`1 day` / `5 days`**. No working-hours,
  holiday or per-agent-timezone model exists in this project; rendering "business day" while the clock
  counts wall-clock minutes would make the card and the countdown disagree by up to 16 hours a day.
- The `Flag in queue, no escalation` and `No escalation` breach sentences are the same behaviour, so
  both render **`No escalation`**, derived by `SlaRule::breachActionLabel()` rather than stored.

### Carried-forward debt this story does not resolve

`Ticket::scopeVisibleTo()` still treats Team Lead as "all tickets" because no `teams` table exists —
debt owned by [`../users-roles-admin/08-story-users-roles-administration.md`](../users-roles-admin/08-story-users-roles-administration.md).
Consequently a breach alert fans out to **every** active Team Lead rather than to the ticket's own.
The fan-out point in `SlaNotifier` carries one `// Story 08:` comment naming where the narrowing goes.
