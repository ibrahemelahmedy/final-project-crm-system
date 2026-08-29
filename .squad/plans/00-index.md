# Plans index

One row per feature folder under `.squad/plans/`. `NN` continues as a global execution sequence across all features when `naming.globalSequence` is `true` in `config.yaml`.

Rows are listed in **execution order**, not alphabetically — read this table top to bottom to know what to build next.

| NN | Feature | Overview | Story | Tracker | Depth |
|----|---------|----------|-------|---------|-------|
| 01 | authentication | [authentication/00-overview.md](authentication/00-overview.md) | Authentication & Access Control | WIS-1 | **implemented** |
| 02 | app-shell | [app-shell/00-overview.md](app-shell/00-overview.md) | Application Shell & Navigation | WIS-10 | **implemented** |
| 03 | customer-management | [customer-management/00-overview.md](customer-management/00-overview.md) | Customer Management | WIS-4 | full |
| 04 | ticket-management | [ticket-management/00-overview.md](ticket-management/00-overview.md) | Ticket Management (Queue) | WIS-2 | full |
| 05 | conversation-thread | [conversation-thread/00-overview.md](conversation-thread/00-overview.md) | Conversation Thread (Ticket Detail) | WIS-3 | full |
| 06 | sla-rules-automation | [sla-rules-automation/00-overview.md](sla-rules-automation/00-overview.md) | SLA Rules & Automation | WIS-6 | full |
| 07 | agent-dashboard | [agent-dashboard/00-overview.md](agent-dashboard/00-overview.md) | Agent Dashboard (Role-Based Home) | WIS-9 | contract |
| 08 | users-roles-admin | [users-roles-admin/00-overview.md](users-roles-admin/00-overview.md) | Users & Roles Administration | WIS-8 | **implemented** |
| 09 | knowledge-base | [knowledge-base/00-overview.md](knowledge-base/00-overview.md) | Knowledge Base | WIS-5 | **implemented** |
| 10 | agent-productivity | [agent-productivity/00-overview.md](agent-productivity/00-overview.md) | Agent Productivity — Quick Replies, Tasks & Collaboration | WIS-12 | **implemented** |
| 11 | notifications | [notifications/00-overview.md](notifications/00-overview.md) | Notifications Centre (in-app) | WIS-13 | **implemented** |
| 12 | reports-dashboards | [reports-dashboards/00-overview.md](reports-dashboards/00-overview.md) | Reports & Management Dashboards | WIS-7 | contract |
| 13 | csat-collection | [csat-collection/00-overview.md](csat-collection/00-overview.md) | CSAT Collection (post-resolution survey) | WIS-14 | contract |
| 14 | channels-overview | [channels-overview/00-overview.md](channels-overview/00-overview.md) | Channels Overview (read-only) | WIS-15 | contract |
| 15 | internationalization | [internationalization/00-overview.md](internationalization/00-overview.md) | Internationalization (Arabic & English) | WIS-11 | contract |

## Two plan depths — read this before implementing

**`full`** — task-level detail verified against real code at plan time: exact file paths, line
ranges, signatures, and runnable commands. Implement straight from the file.

**`contract`** — scope, owned tables/enums/endpoints, cross-story contracts, edge cases, test plan
and done criteria are **final**; task-level file paths and line ranges are deliberately absent,
because the code these stories build on does not exist yet and any line number written today would
be invented. **Before implementing a `contract` story, regenerate it at full depth** by re-running
the plan flow on the same intake:

```
/squad-plan .squad/stories/<feature>/<WIS-id>/intake.md
```

The regenerated plan must keep the story's **Shared contracts** section intact — later stories
already cite it.

## Dependency spine

```
01 authentication ──┬── 02 app-shell ── (every UI story)
                    │
                    └── 03 customers ── 04 tickets ──┬── 05 thread ──┬── 10 productivity
                                                     │               └── 13 CSAT
                                                     ├── 06 SLA ──┬── 07 dashboard
                                                     │            ├── 11 notifications
                                                     │            └── 12 reports
                                                     └── 14 channels
        08 users-roles ── (depends on 01 only; also resolves the `teams` debt)
        09 knowledge-base ── (depends on 02; feeds 05's article picker)
        15 i18n ── (depends on 02; touches every screen's strings — last on purpose)
```

## Cross-cutting rules every plan honours

- **`ticket_events` is the single append-only ticket-history table** (owned by Story 04). Later
  stories append new `event` values. No second history table; nothing about ticket lifecycle goes
  into Story 01's `audit_logs`.
- **`TicketResource.sla` has three frozen keys** (`due_at`, `minutes_left`, `risk`). Story 04 ships
  them `null`; Story 06 fills the values and changes no key.
- **All SQL must be valid on PostgreSQL *and* SQLite** — `api/.env` runs pgsql (Supabase),
  `api/phpunit.xml` runs SQLite `:memory:`.
- **`ticketKeys` is the one TanStack Query keying scheme** for anything ticket-shaped; every ticket
  mutation invalidates `ticketKeys.all`.
- **Filter and pagination state lives in the URL**, never in component state.
- **Every data screen ships all four async states** — loading, error, empty, success.
