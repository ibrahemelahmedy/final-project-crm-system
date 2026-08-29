# Story 12 — Reports & Management Dashboards (Story: WIS-7)

> **Contract-level plan.** Stories 01–02 are implemented; this story executes after Story 11.
> Scope, contracts, and acceptance criteria below are final. Task-level file paths and line
> ranges are deliberately absent — regenerate this plan at full depth (`/squad-plan` on the same
> intake) immediately before implementing, once the code it builds on exists.

## Prerequisites

- **Story 01 completed** (`../authentication/01-story-authentication-access-control.md`) — supplies
  `App\Enums\UserRole` (`agent`, `team_lead`, `administrator`) and `RequireAuth` with its `roles`
  prop. Reports is **denied to the Agent role server-side**; the role model here is the one gate.
- **Story 02 completed** (`../app-shell/02-story-application-shell-navigation.md`) — supplies the
  shell, `UiPreferencesContext` (theme + direction), and the **`/reports` placeholder route this
  story replaces**. `navItems.tsx` already carries the `nav.reports` entry pointing at `/reports`;
  this story adds the `roles` restriction to that entry, it does not add a new one.
- **Story 04** (`../ticket-management/04-story-ticket-management-queue.md`) — owns the expanded
  `tickets` table, `resolved_at`/`closed_at`, and the `Priority` / `TicketStatus` / `Channel`
  enums. Every ticket-volume, channel-mix, and agent-performance figure aggregates over these.
  **Consumed, never redefined.**
- **Story 06** (`../sla-rules-automation/06-story-sla-rules-automation.md`) — owns
  `first_response_due_at`, `resolution_due_at`, and the SLA-risk/breach computation. **This story
  calls that service; it does not reimplement the calculation.** A second implementation that could
  disagree with the Ticket Queue's live indicator is the specific failure this rule prevents.
- **Story 13** (`../csat-collection/13-story-csat-collection.md`) — owns CSAT collection. It does
  **not** exist when this story runs, which is why the CSAT widget ships as an explicit Empty state
  (see Story Goal). This story defines the contract Story 13 will later satisfy.
- **Coordination:** Story 07 (Agent Dashboard) renders an agent-scoped home. This story is the
  **management** view. They share no component; the aggregation endpoint here is management-scoped.

---

## Story Goal

1. A Team Lead/Supervisor or an Administrator opens `/reports` and sees **ticket volume**,
   **SLA performance** (breach rate, average resolution time), and **agent performance**
   (tickets resolved, average response time) for a **selectable date range**.
2. An **Agent is denied access server-side**. The nav entry is also hidden, but hiding a nav item is
   not access control.
3. Changing the date range recomputes **every figure on the page** from that range — no widget
   silently shows a different, stale range.
4. The CSAT widget shows an explicit **"no CSAT data collected yet"** Empty state until Story 13
   lands. Nothing is fabricated and nothing is zeroed to look measured.

**Layout decision.** The page follows the brief's calm-layout rule: a small, named set of
decisions, not every metric the schema could produce. The design export fixes the set at four
cards — Ticket Volume Over Time, SLA Compliance Rate, Tickets by Channel, Agent Performance — and
this story adds exactly one more, CSAT, in its Empty state. **No sixth widget.**

**Charting-library decision (this plan makes the choice; nothing is installed today).**
Use **Recharts**. Install with, run in `web/`:

```
npm i recharts
```

Rationale, stated so the choice is reviewable rather than assumed:
- It renders **SVG**, so series colours can be `var(--…)` tokens from `web/src/index.css` and both
  themes work from the existing token set with no second palette.
- It is a React-first component API, compatible with React 19 as used here, so charts are ordinary
  components inside the feature folder rather than imperative canvas set-up in an effect.
- Axis orientation, tick order, and legend placement are **explicit props**, which is what makes
  the RTL decision below enforceable. A canvas library (Chart.js) was rejected on exactly these two
  points: no CSS-custom-property theming, and no per-axis direction control without a plugin.

**RTL decision (deliberate, not left to the library).** The **plot area stays LTR in both
directions**: a time axis reads left-to-right and numeric axes stay LTR even inside an RTL page,
which matches how Arabic-language interfaces conventionally present numeric charts. Each chart is
therefore wrapped in an element with `dir="ltr"`. Everything **around** the plot — card titles,
legends, the agent-performance table, the range picker — follows the document direction and mirrors
normally.

**Aggregation decision.** Figures are computed **on request** against indexed queries for the MVP;
no materialised rollup table, no scheduled rollup job. This is recorded as a decision with a
threshold: if the reports endpoint exceeds roughly 500 ms on a realistic dataset, introduce a
scheduled rollup as its own follow-up story rather than smearing caching through this one.

**Out of scope.** Building the CSAT collection mechanism (Story 13). Exporting reports to PDF or
Excel. Real-time/live-updating dashboards — periodic refresh on load plus a manual refresh is
sufficient for MVP.

---

## Context — Read These Files First

Every path below was verified to exist at plan time.

1. `docs/design/references/7.Admin Reports/WisalReports-LightLTR.dc.html` and its `-DarkLTR`,
   `-LightRTL`, `-DarkRTL` siblings — **the Reports screen.** Read, in order:
   - the page header `Reports` with the range control reading **`Last 30 days`**;
   - **`Ticket Volume Over Time`** — a time series whose axis ticks are dated
     (`Jul 24`, `Jul 31`, `Aug 7`, `Aug 14`, `Aug 21`);
   - **`SLA Compliance Rate`** — a single large figure (`91%`) with a **`Target: 90%`** subline;
   - **`Tickets by Channel`** — a proportional breakdown listing `Email 44%`, `Live Chat 28%`,
     `WhatsApp 18%`, `Web Form`, `SMS`;
   - **`Agent Performance`** — a table with columns **`AGENT` · `RESOLVED` · `AVG. RESPONSE`**
     (values such as `11m`).
   Read the `-LightRTL` artboard for how the cards, the table, and the legends mirror while the plot
   areas do not.
   **Note: the export contains no CSAT card.** The CSAT Empty state is built as a fifth card in the
   same card shell, using the brief's Empty-state pattern — it is an addition this plan makes, not
   something to look for in the artboard.
2. `docs/design/references/7.Admin Reports/WisalSLARules-LightLTR.dc.html` — the sibling SLA screen
   owned by Story 06. Read it only to keep card, table, and filter-chip styling consistent between
   the two admin screens; **do not implement anything from it here.**
3. `docs/design/brief.md` — "Required states per view" (~lines 181–188): all four async states are
   mandatory. "Explicit anti-patterns" (~lines 208–221) directly constrain this screen: **do not
   accumulate widgets over time**, **do not build a dashboard that requires a tooltip to be
   understood**, **do not encode state in colour alone**. "Internationalization" (~lines 199–207)
   is the basis for the RTL decision above.
4. `.squad/stories/reports-dashboards/WIS-7/intake.md` — acceptance criteria transcribed to Done
   Criteria below 1:1.
5. `web/src/App.tsx` — read the `/reports` route (currently
   `<Route path="/reports" element={<PagePlaceholder title="Reports" />} />`) and the
   `RequireAuth roles={['administrator']}` wrapper pattern used by `/sla-rules` and `/users`.
   `/reports` gets the same treatment with `roles={['team_lead','administrator']}`.
6. `web/src/app/navigation/navItems.tsx` — read the `NavItemDef` type and the existing
   `nav.reports` entry (`group: 'main'`, no `roles`). Add `roles: ['team_lead','administrator']`
   to that entry. Read the comment above `visibleNavItems` — nav filtering is a UX affordance, not
   a security boundary.
7. `api/app/Enums/UserRole.php` — the three cases; the report policy branches on them.
8. `api/routes/api.php` — the existing `auth:sanctum` group the reports route appends to.
9. `web/package.json` — confirm **Recharts is absent** before installing, and note there is
   **no `test` script**: run `npx vitest run`.
10. **Regenerate-time reads** (do not exist yet): Story 04's `tickets` schema and `TicketStatus` /
    `Channel` enum cases — the channel breakdown's categories come from that enum, not from a list
    typed into this plan; Story 06's SLA service class and its breach/at-risk method signatures;
    Story 13's CSAT response table, if it has landed by then.
11. **Known export defect** — grep every `class="..."` in the `.dc.html` artboards against their
    `<style>` block before porting CSS (`fv`/`fvd`, `sk` recur with no rule defined).

---

## Shared contracts this story establishes

**API endpoint owned here** (inside the `auth:sanctum` group):

| Method | Path | Who |
|---|---|---|
| `GET` | `/api/reports/summary?from=<date>&to=<date>` | team_lead, administrator — **403 for agent** |

**One endpoint, one range, one response.** Every widget on the page renders from this single
payload. There is no per-widget endpoint, which is structurally what guarantees that no widget can
show a different range from its neighbours.

Response shape (the contract Story 13 later extends):

```jsonc
{
  "range": { "from": "2026-07-27", "to": "2026-08-26" },
  "ticket_volume": {
    "available": true,
    "points": [{ "date": "2026-07-27", "created": 0, "resolved": 0 }]
  },
  "sla": {
    "available": true,
    "compliance_rate": 91.0,      // percent; from Story 06's service
    "target_rate": 90.0,
    "breach_rate": 9.0,
    "avg_resolution_minutes": 0
  },
  "channels": {
    "available": true,
    "items": [{ "channel": "email", "label": "Email", "count": 0, "percent": 44.0 }]
  },
  "agents": {
    "available": true,
    "items": [{ "user_id": 1, "name": "", "resolved": 0, "avg_response_minutes": 0 }]
  },
  "csat": { "available": false, "reason": "not_collected" }
}
```

**The `available` flag is the contract that makes the Empty-state criteria enforceable.** Zero
underlying data sets `available: false` on that block, and the widget renders its Empty state
instead of a `0%` that reads like a measurement. `csat.available` is hard-coded `false` with
`reason: "not_collected"` until Story 13 lands, at which point Story 13 flips it — **it does not
change the response shape.**

**Authorization owned here** — `App\Policies\ReportPolicy::view` (team_lead, administrator),
registered beside the existing `TicketPolicy`.

**Range contract owned here** — `from` and `to` are ISO dates in **URL search params**, the single
source of truth for the whole page. Presets are `7`, `30`, `90` days; `30` is the default and
matches the artboard's `Last 30 days`. Deep-linking `/reports?from=…&to=…` reproduces the exact
page.

**Frontend public surface** — `web/src/features/reports/index.ts` exports `ReportsPage` only.

**Charting** — `recharts` becomes a `web/` dependency here. Any later story needing a chart uses
this library rather than adding a second one.

---

## Implementation outline

### Backend

- **`App\Policies\ReportPolicy`** — `view()` returns true for `team_lead` and `administrator`.
  Registered in the application's policy registration alongside `TicketPolicy`.
- **`App\Http\Controllers\ReportController@summary`** — authorizes via the policy, validates the
  range, delegates to the aggregator, and returns the resource. **A 403 for an Agent is the
  acceptance criterion; there is no partial payload for that role.**
- **`App\Http\Requests\ReportSummaryRequest`** — validates `from` and `to` as dates, `from <= to`,
  and caps the span (a request for a decade must not be able to table-scan the instance).
  Missing params default to the last 30 days.
- **`App\Services\ReportAggregator`** — one class, one method per block, returning the payload
  above. The SLA block **calls Story 06's service** for compliance and breach figures. Ticket
  volume, channel mix, and agent performance are grouped aggregate queries over Story 04's
  `tickets` table, each honouring the same `from`/`to` bounds, so they cannot diverge.
- **Channel categories** come from Story 04's `Channel` enum, so a channel added there appears here
  without a code change in this story.
- **`available` computation** — each block sets `available: false` when its own underlying row count
  for the range is zero. This is decided in the aggregator, not in the React component.
- **CSAT block** — returns `{"available": false, "reason": "not_collected"}` unconditionally, with a
  comment naming Story 13 as the owner that will make it real.
- **Indexes** — the aggregation queries need indexes on `tickets` covering `created_at`,
  `resolved_at`, `assigned_to`, and `channel`. Story 04 owns the table; **this story adds only the
  indexes it needs, in its own migration, and never alters Story 04's columns.**
- **`ReportSummaryResource`** — pins the exact JSON shape above so the frontend types are generated
  against a stable contract.

### Frontend

- **`web/src/features/reports/`** with `api/ components/ pages/ hooks/ model/ index.ts` per the
  shared folder contract. Server state → TanStack Query. Range state → URL search params.
- **Install Recharts** — `cd web && npm i recharts`, and record the choice plus the RTL rationale in
  a comment at the top of the chart-wrapper component so the decision survives review.
- **Replace the `/reports` placeholder** in `web/src/App.tsx` with `ReportsPage`, wrapped in
  `RequireAuth roles={['team_lead','administrator']}` following the existing `/sla-rules` pattern.
- **Add `roles: ['team_lead','administrator']`** to the existing `nav.reports` entry in
  `navItems.tsx`. No new entry, no hard-coded nav in a component.
- **`useReportSummary(from, to)`** — one query for the whole page. **Because there is one query, a
  range change refetches everything at once and partial staleness is impossible.**
- **`RangePicker`** — the `Last 30 days` control from the artboard, writing `from`/`to` to search
  params.
- **Five card components** — `TicketVolumeCard`, `SlaComplianceCard`, `ChannelMixCard`,
  `AgentPerformanceCard`, `CsatCard`. Each reads its own block from the shared payload and renders
  its Empty state when `available` is false.
- **`ChartFrame`** — the single wrapper that applies `dir="ltr"` to plot areas and passes token
  colours into Recharts. **Every chart goes through it**, so the RTL decision is enforced in one
  place rather than repeated per chart.
- **All four async states** at page level (loading skeleton, error with retry, empty, success), plus
  per-block Empty states inside a successful response.
- **No tooltip-dependent meaning** — every figure the artboard shows is labelled on the surface, per
  the brief's anti-pattern list. Tooltips add precision, never meaning.

---

## Edge Cases & Failure Modes

- **Agent hits `/reports` directly.** Client route guard shows the denied state; the API returns
  **403** regardless. The server response is the criterion — the guard is convenience.
- **Brand-new deployment, no tickets at all.** Every block returns `available: false` and every card
  renders its Empty state. **No card shows `0%` or `0.0`** — that reads as a real measurement of
  perfect performance and is exactly the misleading output the intake calls out.
- **Range with tickets created but none resolved.** Ticket volume is available; agent performance
  and average resolution time are **not** (`available: false`) rather than reporting `0m`.
- **`from` after `to`.** 422 from the form request; the picker prevents it client-side too.
- **Absurdly wide range.** Capped by the form request with a clear validation message.
- **Range straddling a daylight-saving or timezone boundary.** All bucketing is done in a single
  declared timezone in the aggregator, so a day bucket cannot gain or lose an hour relative to the
  Ticket Queue's timestamps.
- **SLA figure disagreeing with the Ticket Queue.** Structurally prevented: the SLA block calls
  Story 06's service. If that service exposes no range-scoped aggregate, **add the range-scoped
  method to Story 06's service** rather than computing it here.
- **Agent deactivated mid-range (Story 08).** Their resolved tickets still count for the period they
  worked; the row renders with the deactivated marker. Dropping the row would make historical totals
  stop reconciling.
- **Channel enum extended by Story 04 after this ships.** New channels appear automatically because
  the categories come from the enum; a channel with zero tickets in range is omitted, not shown at
  `0%`.
- **RTL numeric axes.** Enforced by `ChartFrame`, not by trusting Recharts' defaults. Verified
  visually against the `-DarkRTL` artboard.
- **Reduced motion.** Chart entry animations are disabled under `prefers-reduced-motion`; Recharts
  animation props are set from that media query rather than left on.
- **Stated uncertainty.** Story 06's SLA service signature is **not** known at plan time. Whether
  the range-scoped compliance figure already exists there, or must be added to Story 06's service,
  is decided at regeneration after reading Story 06's shipped code. **It is not reimplemented here
  under any circumstance.**
- **Stated uncertainty.** "Average response time" in the artboard's agent table (`11m`) is
  first-response time, which depends on Story 05's message timestamps and Story 06's
  `first_response_due_at`. The exact derivation is pinned at regeneration; the plan fixes only the
  field name `avg_response_minutes` and its unit.
- **Stated uncertainty.** Recharts' current major version is not pinned in this plan. Install it,
  read the installed version's axis and RTL props before writing `ChartFrame`, and record the
  resolved version in the regenerated plan.

---

## Test Plan

Backend tests are Pest feature tests under `api/tests/Feature/`, following
`api/tests/Feature/TicketScopeTest.php` for role-scoping and `api/tests/Feature/ApiContractTest.php`
for response-shape assertions. Frontend tests are Vitest + Testing Library against
`web/src/test/setup.ts`.

1. `api/tests/Feature/ReportAccessTest.php` — an **agent gets 403**; a team lead and an
   administrator get 200; an unauthenticated request gets 401.
2. `api/tests/Feature/ReportRangeTest.php` — the payload's `range` echoes the request; tickets
   outside the range are excluded from **every** block; omitting the params defaults to 30 days;
   `from > to` returns 422; an over-wide range returns 422.
3. `api/tests/Feature/ReportEmptyDataTest.php` — with zero tickets, every block reports
   `available: false`; **no block reports a zero figure as if measured.** With tickets created but
   none resolved, volume is available and agent performance is not.
4. `api/tests/Feature/ReportSlaSourceTest.php` — the compliance and breach figures match what Story
   06's service returns for the same range. **This is the test that prevents a divergent second
   implementation**; it asserts against the service, not against a hand-computed constant.
5. `api/tests/Feature/ReportCsatContractTest.php` — `csat.available` is `false` with
   `reason: "not_collected"`, and the block is present in the payload (so Story 13 flips a value
   rather than changing the shape).
6. `api/tests/Feature/ReportChannelMixTest.php` — channel categories come from Story 04's `Channel`
   enum; percentages sum to 100 within rounding; a zero-count channel is omitted.
7. `web/src/features/reports/pages/ReportsPage.test.tsx` — the four page-level async states render;
   changing the range updates the URL search params and refetches **one** query; all five cards read
   from that single payload.
8. `web/src/features/reports/components/CsatCard.test.tsx` — renders the
   "no CSAT data collected yet" Empty state and **no chart element**, given `available: false`.
9. `web/src/features/reports/components/ChartFrame.test.tsx` — the plot wrapper carries `dir="ltr"`
   in **both** document directions, while the surrounding card heading follows the document
   direction.
10. `web/src/features/reports/components/AgentPerformanceCard.test.tsx` — the artboard's three
    columns render in order; a deactivated agent's historical row is still present and marked.

---

## Verification Steps

1. **Chart library installed:** `cd web && npm i recharts` — then confirm the resolved version with
   `npm ls recharts` and record it in the regenerated plan.
2. **Backend migrates:** `cd api && php artisan migrate:fresh --seed` — the reporting indexes apply
   on the Story 04 `tickets` table without altering its columns.
3. **Backend tests pass:** `cd api && ./vendor/bin/pest` — new tests green; existing
   `ApiContractTest`, `TicketScopeTest`, and the `Auth/` suite still green.
4. **Frontend tests pass:** `cd web && npx vitest run` — new tests green. (There is **no `test`
   script** in `web/package.json`.)
5. **Lint clean:** `cd web && npm run lint` — no new oxlint findings.
6. **Build clean:** `cd web && npm run build` — `tsc -b` passes with no type errors.
7. **Regression, manual:** `cd web && npm run dev`; sign in as an **Agent** — Reports is absent from
   the sidebar and the direct URL is denied. Sign in as a **Team Lead** — all five cards render,
   changing the range visibly recomputes **every** card, and the CSAT card shows its Empty state.
   Toggle direction to Arabic/RTL and confirm the plot areas stay LTR while cards, legends, and the
   agent table mirror; toggle dark theme and confirm series colours come from the token set.

---

## Done Criteria

- [x] A Team Lead/Supervisor or Administrator opening Reports sees ticket-volume, SLA-performance
      (breach rate, average resolution time), and agent-performance (tickets resolved, average
      handle time) figures for a **selectable date range**.
- [x] An Agent attempting to open Reports is **denied server-side** (403), per the Story 01 role
      model.
- [x] Applying a date range recomputes **all** figures consistently — no widget shows a different,
      stale range, guaranteed by the single-endpoint/single-query design.
- [x] SLA-performance figures read from **Story 06's SLA source of truth**, not a reimplemented
      calculation, asserted by `ReportSlaSourceTest`.
- [x] The CSAT widget shows an explicit **"no CSAT data collected yet"** Empty state, not a
      fabricated or zeroed chart.
- [x] The dashboard follows the brief's **calm-layout** rule — five named cards, no metric sprawl,
      no figure whose meaning depends on a tooltip.
- [x] A figure based on zero underlying data shows an **Empty state**, not a misleading `0%`/`0.0`.
- [x] RTL directionality is a **deliberate decision recorded in code**: plot areas stay LTR via
      `ChartFrame`; legends, tables, and card chrome mirror.
- [x] All four async states ship on the Reports page.
- [x] The `/reports` `PagePlaceholder` from Story 02 is replaced and the `nav.reports` entry carries
      its role restriction.
- [ ] The charting-library choice (**Recharts**) and its rationale are recorded in the plan and in a
      code comment, with the resolved version noted.
- [x] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 13.**
