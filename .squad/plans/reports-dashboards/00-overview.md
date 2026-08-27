# reports-dashboards — plan overview

Entry point for the **reports-dashboards** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 12 | [12-story-reports-dashboards.md](12-story-reports-dashboards.md) | Reports & Management Dashboards | WIS-7 | Stories 01, 02, 04, 06 |

## Dependency notes

**Plan status: contract-level (skeleton).** Story 12 executes after Story 11 against code that does
not exist yet. Its scope, contracts, and acceptance criteria are final; task-level file paths and
line ranges are deliberately absent and must be filled in by regenerating the plan at full depth
immediately before implementation.

**Sequenced last among the reporting-adjacent stories**, because it aggregates data produced by
Stories 04 and 06.

- **Depends on** [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md):
  the expanded `tickets` table, `resolved_at`/`closed_at`, and the `Channel` and `TicketStatus`
  enums. Ticket volume, channel mix, and agent performance all aggregate over these. Story 12 adds
  only the **indexes** it needs, in its own migration, and never alters Story 04's columns.
- **Depends on** [`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md):
  SLA compliance and breach figures **call Story 06's service**. A second implementation that could
  disagree with the Ticket Queue's live SLA indicator is the specific failure this rule prevents,
  and a dedicated test asserts the figures against that service rather than a hand-computed
  constant. If Story 06 exposes no range-scoped aggregate, the method is added **there**, not here.
- **Depends on** [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md):
  Story 12 **replaces the `/reports` `PagePlaceholder`** Story 02 created, and adds
  `roles: ['team_lead','administrator']` to the existing `nav.reports` entry in
  `web/src/app/navigation/navItems.tsx`. No new nav entry; nav filtering is a UX affordance, and the
  `ReportPolicy` is the gate.
- **Related** [`../csat-collection/13-story-csat-collection.md`](../csat-collection/13-story-csat-collection.md):
  CSAT collection does not exist when Story 12 runs. Story 12 defines the `csat` block of the
  reports payload as `{"available": false, "reason": "not_collected"}` so Story 13 later **flips a
  value rather than changing the response shape**. Nothing is fabricated or zeroed in the meantime.
- **Shared contracts this story establishes**, which later stories consume rather than redefine:
  - `GET /api/reports/summary?from=&to=` — **one endpoint, one range, one payload** for the whole
    page. That single-query design is structurally what guarantees no widget can show a stale or
    different range from its neighbours.
  - The `available` flag on every payload block — the contract that makes "Empty state, not a
    misleading 0%" enforceable server-side rather than by component judgement.
  - `App\Policies\ReportPolicy::view` — Team Lead and Administrator only; **an Agent gets 403**.
  - Range as ISO `from`/`to` in **URL search params**, presets 7/30/90 days, 30 the default, so
    `/reports?from=…&to=…` deep-links reproducibly.
  - `web/src/features/reports/index.ts` exporting `ReportsPage` only.
- **Two decisions the plan makes explicitly**, because neither exists in the codebase today:
  - **Charting library: Recharts** (`npm i recharts` in `web/`), chosen for SVG output that themes
    from the existing `index.css` token set and for explicit per-axis direction props. Chart.js was
    rejected on both points. Any later story needing a chart uses this library, not a second one.
  - **RTL directionality: plot areas stay LTR in both directions**, enforced in one place by a
    `ChartFrame` wrapper; legends, the agent-performance table, and card chrome mirror normally.
- **Layout is fixed at five cards** — Ticket Volume Over Time, SLA Compliance Rate, Tickets by
  Channel, Agent Performance (all four from `docs/design/references/7.Admin Reports/`), plus a CSAT
  card in its Empty state that the export does not contain. **No sixth widget**, per the design
  brief's calm-layout rule and its anti-pattern against metric accumulation.
