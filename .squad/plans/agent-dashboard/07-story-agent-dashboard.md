# Story 07 — Agent Dashboard (Role-Based Home) (Story: WIS-9)

> **Contract-level plan.** Stories 01–02 are implemented; this story executes after Story 06.
> Scope, contracts, and acceptance criteria below are final. Task-level file paths and line
> ranges are deliberately absent — regenerate this plan at full depth (`/squad-plan` on the same
> intake) immediately before implementing, once the code it builds on exists.

## Prerequisites

- **Story 01 completed** — [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md).
  Supplies `App\Enums\UserRole` (`agent` · `team_lead` · `administrator`, with `label()` and
  `homeRoute()`), `UserResource` (`role`, `role_label`, `home_route`), and on the frontend
  `useAuth()` plus `RequireAuth` with its `roles?` prop.
- **Story 02 completed** — [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md).
  Supplies `AppLayout`, `navItems.tsx` (whose `resolveNavItems` already points the single
  **Dashboard** nav entry at `user.home_route`), `UiPreferencesContext` (theme + direction), and
  the **three placeholder routes this story replaces**: `/dashboard`, `/dashboard/team`,
  `/dashboard/admin` — each currently renders `PagePlaceholder`, the latter two already wrapped in
  a role-scoped `RequireAuth`.
- **Story 04 completed** — [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md).
  Owns the expanded `tickets` table, the `Priority` / `TicketStatus` / `Channel` enums, and
  `TicketResource`. **This story consumes that contract and redefines none of it.**
- **Story 06 completed** — [`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md).
  Owns `first_response_due_at`, `resolution_due_at`, and the SLA-risk computation. The
  "Approaching SLA breach" widget **calls that computation**; it must not reimplement a threshold.
- **Story 03 completed** — [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md)
  for `customers.name`, rendered in the My Queue widget's CUSTOMER column.
- **Coordination:** the Quick Replies widget surfaces data owned by Story 10
  (`../agent-productivity/10-story-agent-productivity.md`), which executes **after** this story.
  See *Edge Cases* for the agreed fallback.

---

## Story Goal

Replace the three dashboard placeholders with three genuinely different role-based homes. Content
differs by role, not widget visibility.

1. An **Agent** landing on `/dashboard` sees three stat tiles (**Assigned to me**, **Approaching
   SLA breach**, **Resolved today**), a **My Queue** table (subject · customer · priority · SLA
   left), an **Approaching SLA Breach** list, and a **Quick Replies** list.
2. A **Team Lead** landing on `/dashboard/team` sees a team header (team name · agent count), three
   tiles (**Team open tickets**, **Active escalations**, **Team SLA compliance**), a **Workload
   Balance** bar per agent, and a **Current Escalations** list with escalator and age.
3. An **Administrator** landing on `/dashboard/admin` sees **no ticket queue at all** — three
   entry-point cards: **User Management** (→ `/users`), **SLA Rule Configuration** (→ `/sla-rules`),
   **Audit Log** (→ the audit viewer route owned by Story 08), each with a live count subtitle.
4. Every widget fetches independently. A slow widget shows its own skeleton without blocking the
   rest of the page.
5. Every widget has its own Empty state naming a next action; a zero count is never rendered as an
   error, and an error is never rendered as a zero.
6. Under `dir="rtl"` the grid, tile order, and widget order mirror with the shell.

**Explicitly NOT in scope:**

- **Acting** on an escalation (reassign, resolve, close). The escalation row links to the ticket;
  Stories 04/05 own the action.
- Any metric not already produced by Stories 04 or 06. Full analytics is Story 12
  (`../reports-dashboards/12-story-reports-dashboards.md`).
- Authoring or editing quick replies — Story 10 owns that; this story only reads and inserts.
- Adding a nav item. `navItems.tsx` already has **Dashboard**; this story does not edit it.

---

## Context — Read These Files First

Verified to exist at plan time. For anything a future story owns, the owning plan is named instead
of a path.

1. `docs/design/references/0.Dashboard/WisalAgentDashboard-Agent-LightLTR.dc.html` — **134 lines,
   the primary Agent reference.** Every string in the Story Goal comes from it verbatim ("Good
   afternoon, Sarah", "Assigned to me", "Approaching SLA breach", "Resolved today", "My Queue", the
   `SUBJECT / CUSTOMER / PRIORITY / SLA LEFT` headers, "Quick Replies").
2. `…-TeamLead-LightLTR.dc.html` (120 lines) — "Team overview", "Support Ops · 5 agents", the three
   tile labels, "Workload Balance", "Current Escalations", and the `Escalated by <name> · <age>`
   subtitle format. `…-Admin-LightLTR.dc.html` (102 lines) — "Admin overview", "Platform
   configuration and oversight", and the CTAs "Manage users" / "Configure rules" / "View log".
3. The three `*-DarkLTR.dc.html` siblings — dark palette only; structure identical.
4. **Grep before porting any CSS.** All six Dashboard artboards carry `class="fv"` in markup. Grep
   every `class="…"` against the `<style>` block before trusting a rule exists — the recurring
   export defect recorded in `STATUS.md`. **There is no RTL Dashboard artboard** — mirror with
   logical properties per Story 02's precedent, not a second stylesheet.
5. `docs/design/brief.md` — **"Role-based home (Agent Dashboard)"** (the three role bullets this
   story implements literally), **"Required states per view"**, **"Explicit anti-patterns"** (a
   widget needs a named user need; no dashboard needing a tooltip; priority and status are never one
   badge), **"Internationalization"**.
6. `.squad/stories/agent-dashboard/WIS-9/intake.md` — the acceptance criteria the Done Criteria map
   to 1:1. `attachments/` is empty.
7. `web/src/App.tsx` — the three dashboard `<Route>` entries and their existing `RequireAuth` role
   guards. This story swaps the `element`; it does not change the guards.
8. `web/src/app/navigation/navItems.tsx` — read `resolveNavItems`, which already rewrites the
   Dashboard entry to `user.home_route`. Confirm active-marking survives the swap.
9. [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md)
   — the precedent for the four-state pattern, the logical-properties RTL approach, and the
   "exports are a visual reference only; accessible structure is new work" rule.

---

## Shared contracts this story establishes

Later stories may cite these. This story owns them.

**Backend — `api/`**

| Endpoint | Role | Returns |
|---|---|---|
| `GET /api/dashboard/agent/summary` | agent, team_lead, administrator | `{ assigned_count, sla_risk_count, resolved_today_count }` for **the caller** |
| `GET /api/dashboard/agent/queue` | as above | up to 5 `TicketResource` items assigned to the caller, ordered by SLA urgency |
| `GET /api/dashboard/agent/sla-risk` | as above | up to 5 `TicketResource` items whose SLA risk is `at_risk` or `breached` |
| `GET /api/dashboard/team/summary` | team_lead, administrator | `{ team_name, agent_count, open_count, escalation_count, sla_compliance_pct }` |
| `GET /api/dashboard/team/workload` | team_lead, administrator | array of `{ user_id, name, open_count }` |
| `GET /api/dashboard/team/escalations` | team_lead, administrator | escalated `TicketResource` items + `escalated_by_name`, `escalated_at` |
| `GET /api/dashboard/admin/summary` | administrator | `{ user_count, department_count, active_sla_rule_count }` |

- One endpoint per widget — **this is the mechanism that satisfies the independent-skeleton AC.**
  Do not collapse them into one aggregate response.
- All live behind `auth:sanctum` and a role gate. **Server-side authorization is the boundary**;
  the route guard is UX only.
- No new table and no new migration. Every field is derived from `tickets` (Story 04), the SLA
  columns (Story 06), `users`, and `customers` (Story 03).
- `App\Http\Controllers\DashboardController` and `App\Services\DashboardMetrics` are owned here.
  Story 12 (Reports) reuses `DashboardMetrics` rather than writing a second aggregation layer.

**Frontend — `web/src/features/agent-dashboard/`**

- Standard folder shape (`api/ components/ pages/ hooks/ model/ index.ts`); `index.ts` is the only
  public surface.
- Public exports: `AgentDashboardPage`, `TeamDashboardPage`, `AdminDashboardPage`. **Three sibling
  page components, one per role — not one component with role conditionals inside.**
- Each widget is a self-contained component owning its own `useQuery` and its own four states.
  A widget never receives server data as a prop from its page.
- Query keys are namespaced `['dashboard', <role>, <widget>]` so Story 11 (notifications) and
  Story 12 can invalidate precisely.
- SLA-risk rendering reuses the badge component and design token established by Story 04. This
  story does **not** define a second SLA visual.

---

## Implementation outline

Bullet level by design. File-by-file detail is regenerated before implementation.

### Backend

Everything below is **owned by this story** unless the bullet names another owner.

- **`DashboardController`** — one action per endpoint in the table above; routes registered in
  `api/routes/api.php` inside the existing `auth:sanctum` group under a `/dashboard` prefix.
- **`DashboardMetrics` service** — every aggregation query; controllers stay thin. It calls Story
  06's SLA-risk computation and **does not re-derive a threshold**. Reused by Story 12.
- **Role gating** for the team and admin endpoint groups, using the gate layer **Story 08 owns**.
  Until Story 08 lands, gate with an explicit `UserRole` check in the controller and leave a comment
  naming Story 08 as the consolidation point.
- Reuse **`TicketResource`** for every ticket payload. Dashboard-only fields (`escalated_by_name`,
  `escalated_at`) go in a thin wrapper resource, **not** by widening `TicketResource`, which
  **Story 04 owns**.
- **No migration. No model changes. No enum changes.**

### Frontend

Everything below is **owned by this story** unless the bullet names another owner.

- `web/src/features/agent-dashboard/` with the standard folder shape.
- **`AgentDashboardPage`** — greeting header, three stat tiles, `MyQueueWidget`, `SlaRiskWidget`,
  `QuickRepliesWidget`.
- **`TeamDashboardPage`** — team header, three tiles, `WorkloadBalanceWidget`, `EscalationsWidget`.
- **`AdminDashboardPage`** — three `AdminEntryCard`s linking to `/users`, `/sla-rules`, and the
  audit-log route. **No ticket list.**
- One **`DashboardWidget`** shell (card frame, title, four-state switch) so no widget hand-rolls a
  skeleton, and one **`StatTile`** (label · value · optional delta).
- Swap the three `<Route element>` values in `web/src/App.tsx` from `PagePlaceholder` to the three
  pages. **Leave the `RequireAuth roles` props exactly as they are.** The route tree is **Story 02's**;
  this is the sanctioned replacement.
- Typed API functions + query hooks in `features/agent-dashboard/api/`, on the shared Axios instance
  in `web/src/lib/api.ts`. **Do not create a second Axios client.**
- **No change to `navItems.tsx`, `AppLayout.tsx`, `UiPreferencesContext.tsx`, or `index.css`
  tokens.** If a needed token is missing, add it to `index.css` and say so in the regenerated
  plan — never inline a hex value.

---

## Edge Cases & Failure Modes

- **A widget's request fails while its siblings succeed.** Only that widget shows its error state
  with a retry control; the page still renders. Enforced by per-widget `useQuery` — one shared query
  for the page would break this AC.
- **Zero vs. error.** A `200` with an empty array renders the Empty state ("No tickets assigned to
  you yet"); a non-2xx renders the Error state. A zero is never shown as an error, and an error is
  never shown as `0`.
- **Team Lead with zero agents.** Workload Balance renders an Empty state, not a zero-height chart.
  With no resolved tickets in the window `sla_compliance_pct` returns `null` (never `0/0`) and the
  tile renders `—`.
- **SLA fields null on legacy tickets.** Rows created before Story 06 backfills may have a null
  `resolution_due_at`. They are **excluded** from the SLA-risk widget and from the compliance
  percentage — not counted as compliant.
- **An Administrator opens `/dashboard`.** `homeRoute()` sends them to `/dashboard/admin`, but
  `/dashboard` is reachable directly and is not role-guarded. It renders the Agent view scoped to
  their own assignments; Empty states there are correct, not a bug.
- **Team Lead reaching `/dashboard/admin`.** Blocked by the existing
  `RequireAuth roles={['administrator']}` **and** by the server-side gate on
  `GET /api/dashboard/admin/summary`. Both must hold.
- **Quick Replies before Story 10 exists.** *Stated uncertainty:* Story 10 owns the quick-replies
  data model and executes after this story. This story ships `QuickRepliesWidget` reading
  `GET /api/quick-replies` and rendering its **Empty state** when that endpoint returns 404 or an
  empty list. The widget is not deleted and no placeholder data is invented. Story 10 makes it
  live without changing the widget's contract.
- **Escalation source.** *Stated uncertainty:* whether "escalated" is a `TicketStatus` case, a
  boolean column, or a ticket-history event is decided by Story 04. The regenerated plan must read
  Story 04's shipped schema and bind to it; **do not add an `escalated_at` column here.**
- **Audit-log route target.** *Stated uncertainty:* the Admin card's "View log" destination is
  owned by Story 08. Until 08 lands the card links to `/users`; the regenerated plan repoints it.
- **RTL with no artboard.** No RTL Dashboard export exists. Mirroring is implemented with logical
  properties and verified manually by toggling direction — not by copying a mirrored file.
- **Reduced motion.** Workload Balance bars animate on mount; under `prefers-reduced-motion` they
  render at their final width immediately.
- **Timezone.** "Resolved today" and "12m ago" are computed against the **server's** timezone and
  sent as ISO-8601 with offset. The client formats; it does not recompute the day boundary.

---

## Test Plan

**Backend (Pest, `api/tests/Feature/`) — follow the pattern in `api/tests/Feature/TicketScopeTest.php`.**

1. `Dashboard/AgentDashboardTest.php` — an Agent's `summary` counts only their **own** assigned
   tickets; another agent's tickets never appear in `queue`; `resolved_today_count` excludes
   yesterday's resolutions.
2. `Dashboard/TeamDashboardTest.php` — a Team Lead gets team-scoped counts; **an Agent calling any
   `/api/dashboard/team/*` endpoint receives 403**; `sla_compliance_pct` is `null` with no
   resolved tickets in the window.
3. `Dashboard/AdminDashboardTest.php` — an Administrator gets `admin/summary`; **both an Agent and
   a Team Lead receive 403**.
4. `Dashboard/SlaRiskSourceTest.php` — a ticket whose SLA risk is computed by Story 06's service
   appears in `agent/sla-risk`, and a ticket with a **null** `resolution_due_at` does not. Asserts
   the widget reads the shared source.
5. Extend `api/tests/Feature/ApiContractTest.php` with the response shape of each of the seven new
   endpoints so a later story cannot silently rename a key.

**Frontend (Vitest + Testing Library, `web/src/features/agent-dashboard/`).**

6. `AgentDashboardPage.test.tsx` — renders all four widgets; **one widget's query rejecting leaves
   the other three rendered** (the independent-loading AC); an empty queue renders the Empty copy,
   not `0`.
7. `TeamDashboardPage.test.tsx` — renders Workload Balance and Escalations; zero agents renders the
   Empty state; an escalation row links to the ticket route.
8. `AdminDashboardPage.test.tsx` — **asserts no ticket table is rendered**; the three cards link to
   `/users`, `/sla-rules`, and the audit route.
9. `dashboardRoutes.test.tsx` — follows `web/src/app/navigation/navRoutes.test.tsx`. Each role's
   `home_route` resolves to its own page, and a Team Lead is refused `/dashboard/admin`.
10. `DashboardWidget.test.tsx` — the shared shell renders each of the four states from an explicit
    prop, and the loading state exposes an accessible busy indication.

---

## Verification Steps

1. **Backend tests pass:** `cd api && ./vendor/bin/pest` — all new Dashboard tests green, no
   regression in `ApiContractTest` or `TicketScopeTest`.
2. **Backend static check:** `cd api && php artisan route:list --path=dashboard` — all seven routes
   present and inside the `auth:sanctum` middleware group.
3. **Frontend tests pass:** `cd web && npx vitest run` (**there is no `test` script in
   `web/package.json`**).
4. **Lint clean:** `cd web && npm run lint` — no new findings.
5. **Regression, manual:** `cd web && npm run dev`; sign in as each of the three roles and confirm
   each lands on a distinct dashboard, that the sidebar **Dashboard** item is marked active with
   `aria-current="page"` on all three, and that no page scrolls horizontally at the 1024px
   breakpoint.
6. **RTL check:** toggle direction in the shell and confirm the tile row, widget grid, and table
   column order all mirror, and the SLA-risk colours keep their meaning.

---

## Done Criteria

Mapped 1:1 to `.squad/stories/agent-dashboard/WIS-9/intake.md`.

- [ ] An Agent's home shows their own assigned queue, tickets approaching SLA breach, and
      quick-reply shortcuts — content differs from the other roles, not just widget visibility.
- [ ] A Team Lead's home shows the team queue, workload balance across agents, and current
      escalations — not the single-agent view.
- [ ] An Administrator's home shows entry points into user management, SLA rule configuration, and
      the audit log — **and no ticket queue**.
- [ ] Every widget on every role's dashboard maps to a named bullet in the design brief's
      "Role-based home" list. No widget was added because data was available.
- [ ] The "approaching SLA breach" widget reads Story 06's SLA-risk source; no threshold check is
      reimplemented in this feature.
- [ ] On first load each widget shows its own loading skeleton independently; a slow or failing
      widget does not block the page.
- [ ] A role with zero relevant items sees an Empty state with a clear next action — not an error
      and not a misleading zero.
- [ ] Under RTL the dashboard mirrors consistently with the app shell (nav, tile order, widget
      order, table columns).
- [ ] Every `/api/dashboard/*` endpoint is authorized server-side; an Agent calling a team or admin
      endpoint gets 403 regardless of the frontend nav.
- [ ] `web/src/App.tsx` no longer renders `PagePlaceholder` at `/dashboard`, `/dashboard/team`, or
      `/dashboard/admin`.
- [ ] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 08.**
