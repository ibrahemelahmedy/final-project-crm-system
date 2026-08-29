# agent-dashboard — plan overview

Entry point for the **agent-dashboard** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on | Status |
|----|------|-------|------------|------------|--------|
| 07 | [07-story-agent-dashboard.md](07-story-agent-dashboard.md) | Agent Dashboard (Role-Based Home) | WIS-9 | Stories 01, 02, 03, 04, 06 | ✅ Implemented 2026-08-28 |

## Implementation notes (2026-08-28)

- **Backend:** `App\Http\Controllers\DashboardController` (7 actions, one per widget) + `App\Services\DashboardMetrics` (all aggregation) + `App\Services\SlaCalculator` (the single SLA-risk threshold authority until Story 06's engine consolidates it — prefers Story 06's stored `resolution_due_at` / `sla_at_risk_at` / `escalated_at` columns when populated, otherwise computes from the seeded `sla_rules` row for the ticket's priority). `App\Http\Resources\DashboardTicketResource` wraps `TicketResource` (fills the `sla` block, adds `escalated_by_name` / `escalated_at`) — `TicketResource` is **not** widened. Routes under the `/dashboard` prefix inside the existing `auth:sanctum` group; team/admin groups gated by an explicit `UserRole` check in the controller (Story 08 is the consolidation point). Four SLA rules seeded in `DatabaseSeeder`.
- **`admin/summary` shape:** returns `{ user_count, active_sla_rule_count, audit_log_count }` — `audit_log_count` replaces the contract's `department_count` because no departments table exists yet (Story 08). The three Admin cards' live-count subtitles read these.
- **Audit Log card** links to `/users` until Story 08 ships the audit-viewer route.
- **Frontend:** `web/src/features/agent-dashboard/` standard shape. `AgentDashboardPage` / `TeamDashboardPage` / `AdminDashboardPage` (three siblings), `DashboardWidget` four-state shell + `widgetState` helper, `StatTile`, and the six widgets (`MyQueueWidget`, `SlaRiskWidget`, `QuickRepliesWidget`, `WorkloadBalanceWidget`, `EscalationsWidget`, `AdminEntryCard`). Each widget owns its own `useQuery`. `App.tsx` swaps the three `PagePlaceholder` elements; `RequireAuth roles` props untouched. `PriorityBadge` / `SlaCell` re-exported from `features/tickets` — no second SLA visual. Dashboard CSS appended to `index.css` (logical properties, no new tokens).
- **Tests:** `api/tests/Feature/Dashboard/{AgentDashboardTest,TeamDashboardTest,AdminDashboardTest,SlaRiskSourceTest}.php` + dashboard shapes added to `ApiContractTest`. `web/src/features/agent-dashboard/` — `DashboardWidget.test.tsx`, `AgentDashboardPage.test.tsx`, `TeamDashboardPage.test.tsx`, `AdminDashboardPage.test.tsx`, `pages/dashboardRoutes.test.tsx`.

## Dependency notes

**This is a composition story — it aggregates data other stories own and introduces no data of its
own.** It is deliberately sequenced after the core loop (03–06) so every widget reads a shipped
contract rather than a stubbed one. Story 07 is planned at **contract level**: scope, endpoints,
and acceptance criteria are final; task-level file paths are regenerated immediately before
implementation.

- **Depends on** [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md):
  `UserRole` and its `homeRoute()` decide which of the three dashboards a user lands on.
- **Depends on** [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md):
  the three routes this story fills — `/dashboard`, `/dashboard/team`, `/dashboard/admin` —
  already exist as `PagePlaceholder`, with `RequireAuth` role guards already applied to the latter
  two. `resolveNavItems` already points the single **Dashboard** nav entry at `user.home_route`, so
  **`navItems.tsx` is not edited by this story.**
- **Depends on** [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md)
  for the `tickets` schema, the `Priority`/`TicketStatus`/`Channel` enums, and `TicketResource` —
  **consumed, never redefined**, including the SLA-risk badge and its design token.
- **Depends on** [`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md):
  the "Approaching SLA breach" widget calls that story's SLA-risk computation. Reimplementing a
  threshold here would fail an explicit acceptance criterion.
- **Depends on** [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md)
  for the customer name rendered in the My Queue widget.
- **Soft dependency on** [`../agent-productivity/10-story-agent-productivity.md`](../agent-productivity/10-story-agent-productivity.md),
  which executes **later**: the Quick Replies widget ships reading `GET /api/quick-replies` and
  renders its Empty state until Story 10 makes that endpoint live. No placeholder data is invented.

**Shared contracts this story establishes**, which later stories consume rather than redefine:

- **Seven per-widget endpoints under `/api/dashboard/`** (`agent/summary`, `agent/queue`,
  `agent/sla-risk`, `team/summary`, `team/workload`, `team/escalations`, `admin/summary`).
  One endpoint per widget is the mechanism behind the independent-loading-skeleton criterion —
  they are never collapsed into one aggregate response.
- **`App\Services\DashboardMetrics`** — the single aggregation layer.
  [`../reports-dashboards/12-story-reports-dashboards.md`](../reports-dashboards/12-story-reports-dashboards.md)
  reuses it rather than writing a second one.
- **`web/src/features/agent-dashboard/index.ts`** exporting `AgentDashboardPage`,
  `TeamDashboardPage`, `AdminDashboardPage` — three sibling components, not one component with role
  conditionals — plus the shared `DashboardWidget` four-state shell and `StatTile`.
- **Query-key namespace `['dashboard', <role>, <widget>]`**, so Stories 11 and 12 can invalidate
  precisely.

**No new table, no migration, no enum.** Every value is derived from data Stories 03, 04, and 06
already own.
