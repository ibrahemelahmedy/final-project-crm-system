# channels-overview — plan overview

Entry point for the **channels-overview** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on | Status |
|----|------|-------|------------|------------|--------|
| 14 | [14-story-channels-overview.md](14-story-channels-overview.md) | Channels Overview (read-only) | WIS-15 | Stories 01, 02, 04 | ✅ Implemented |

## Dependency notes

**This story closes the broken `Channels` nav item** found in the 2026-08-24 gap review. The App Shell
ships a Channels entry, but no story or design existed for its destination — shipping the slate as it
stood would leave a link to a placeholder.

**Decision recorded so a later reader does not mistake the screen for unfinished work:** two options
were considered — remove the nav item, or build an honest read-only overview. The overview won, because
the ticket model already records channel-of-origin and the architecture is genuinely ready for
integration. Removing the item would signal the capability does not exist at all; a status screen says
"ready, not yet connected" truthfully. **No screen may imply ingestion works when it does not.**

Story 14 is **contract-level (skeleton)**. It executes after code that does not exist today, so its
scope, contracts, and acceptance criteria are final while its task-level file paths and line ranges
are deliberately absent. **Regenerate it at full depth (`/squad-plan` on the same intake) immediately
before implementing.**

- **Depends on** [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md):
  Story 02 created the `nav.channels` entry in `web/src/app/navigation/navItems.tsx` and the
  `PagePlaceholder` route at `/channels`. **Story 14 replaces that placeholder and adds no nav entry** —
  the manifest already has one. Story 02's `it.each(navItems)` route test must keep passing unchanged.
- **Depends on** [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md):
  the `tickets.channel` column and the **`Channel` enum**. Story 14 **consumes** that enum as the single
  source of the channel list and defines no parallel list anywhere — not in a constant, not in a
  frontend array, not in a seeder.
- **Shared contracts this story establishes:**
  - `GET /api/channels/overview?period=7d|30d|90d` — `auth:sanctum`, any role, default `30d`, an
    unrecognised value is a 422. Returns **all** enum channels in declaration order with
    `value`, `label_key`, `status`, `ticket_count`, plus `meta.has_tickets` as the whole-screen empty
    signal. Counts come from a single `GROUP BY` aggregate, never from client-side counting.
  - `status` is the literal `not_connected` for **every** channel in this release — a field, not a
    health check. The status pill component has no connected variant and no uptime element, so a future
    bug cannot render a fabricated healthy state.
  - `web/src/features/channels/index.ts` exports `ChannelsPage` only.
  - Period selection lives in the URL (`?period=30d`), per the shared frontend state contract.
- **This story adds no migration, no table, and no write endpoint.** That is asserted in its Done
  Criteria and by a route audit in its Verification Steps.
- **Labels ship as English literals with `labelKey`-style keys already assigned**, following the pattern
  Story 02 set in `navItems.tsx`, so [`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md)
  replaces values, not structure.
- **Out of scope and owned elsewhere:** connecting any provider (category 11 — Integrations); inbound
  ingestion, webhook receivers, or channel-specific composer behaviour; an embeddable live-chat widget;
  any credential entry or OAuth flow.

## Implementation notes (Story 14, shipped 2026-08-28)

- **Backend:** `ChannelOverviewController` (`__invoke`), `ChannelOverviewRequest`
  (period `7d|30d|90d`, nullable, default `30d`, unrecognised → 422), `ChannelOverviewResource`.
  Route `GET /api/channels/overview` inside the `auth:sanctum` + `active` group — no write verb.
  Counts come from **one** `GROUP BY channel` aggregate run through `Ticket::visibleTo()`, so an
  Agent's counts inherit the queue's visibility scope. `total_tickets` is counted separately from
  the grouped query so a (currently impossible) NULL-channel row would land in the total and in no
  card. **No migration, model, or policy** — zero schema added; `tickets.channel` already has an
  index from Story 04's `expand_tickets_table` migration.
- **Frontend:** `web/src/features/channels/` — `index.ts` exports `ChannelsPage` only. Period lives
  in `?period=` (`useChannelPeriod`, clamps unknown values to `30d` without a request). Channel list
  always comes from the API (`Channel::cases()`); `model/channel.ts` holds only decorative help-line
  + icon copy keyed by enum value, with a generic never-`undefined` fallback for an unknown value.
  `ChannelCard`'s status pill has no connected variant and no uptime element. Error state keeps the
  five cards rendered with `Count unavailable` + a `Retry`; empty/zero renders `No tickets this
  period`, never a literal `0`. Admin-only static release notice from `AuthContext` role — no
  button/link/form. `App.tsx` `/channels` route swapped from `PagePlaceholder` to `ChannelsPage`;
  `navItems.tsx` untouched.
- **Tests:** `api/tests/Feature/Channels/{ChannelOverviewTest,ChannelOverviewEmptyTest,ChannelOverviewAuthTest}.php`
  (incl. enum-drift guard) + `ApiContractTest` extension; `web/src/features/channels/**` — page states,
  role branching, `PeriodSelector` URL behaviour. All green.
- **Known unrelated red in the tree at ship time:** concurrent in-flight stories left
  `navItems.test.ts` (a 9th `/quick-replies` nav entry), `CustomerResource`, and CSAT route tests
  failing, plus `tsc` errors under `agent-productivity`/`tickets/thread`. None touch channels code.
