# Story 14 — Channels Overview (read-only) (Story: WIS-15)

> **Contract-level plan.** Stories 01–02 are implemented; this story executes after Story 13.
> Scope, contracts, and acceptance criteria below are final. Task-level file paths and line
> ranges are deliberately absent — regenerate this plan at full depth (`/squad-plan` on the same
> intake) immediately before implementing, once the code it builds on exists.

## Prerequisites

- **Story 01 completed** (`../authentication/01-story-authentication-access-control.md`) — Sanctum
  session and `UserRole`. The overview endpoint sits inside `auth:sanctum`; the admin-only notice is
  driven by the signed-in user's role.
- **Story 02 completed** ([`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md))
  — created the `Channels` nav item (`web/src/app/navigation/navItems.tsx`, `labelKey: 'nav.channels'`,
  `to: '/channels'`) and the `PagePlaceholder` route it currently points at. **This story replaces that
  placeholder.** The nav manifest entry already exists and must not be duplicated.
- **Story 04 completed** ([`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md))
  — owns `tickets.channel` and the **`Channel` enum** in `api/app/Enums/`. This story **consumes** that
  enum as the single source of the channel list and does not define a second one.
- **Story 15 not required.** Labels ship as English literals with `labelKey`-style keys already assigned
  (matching the pattern Story 02 established in `navItems.tsx`), so Story 15 replaces values, not
  structure.

---

## Story Goal

1. The `Channels` nav item, which today leads to a placeholder, leads to a **real rendered screen**.
   The core acceptance test of this story is that no nav item in the shipped product leads nowhere.
2. That screen lists the five channels of client requirement category 3 — **Email, WhatsApp, Live chat,
   SMS, Web forms** — each with an explicit connection status.
3. Every channel reads unambiguously as **Not connected**, with a one-line explanation of what
   connecting would require. No fabricated "Connected", no fake uptime, no mocked health indicator.
4. Each channel shows a **real** ticket count for a selectable period (7 / 30 / 90 days), computed by an
   aggregate query over the `channel` column on real ticket rows.
5. An Agent sees a purely read-only screen. An Administrator additionally sees a plain statement that
   channel integration is not available in this release — not a form that cannot work.

**Explicitly out of scope:** connecting any provider (category 11 — Integrations); inbound message
ingestion, webhook receivers, or channel-specific composer behaviour; an embeddable live-chat widget;
any credential entry or OAuth flow. **No table, no migration, no write endpoint exists in this story.**

**Why a screen rather than removing the nav item** (record this so a later reader does not mistake the
screen for unfinished work): the ticket model already records channel-of-origin, so the architecture is
genuinely ready for integration. Removing the nav item would signal the capability does not exist at
all; an honest status screen communicates "ready, not yet connected" truthfully. That was the decision
taken in the 2026-08-24 gap review.

---

## Context — Read These Files First

Only files verified to exist today are listed. Everything else is named by the story that owns it.

1. `.squad/stories/channels-overview/WIS-15/intake.md` — the acceptance criteria this plan's Done
   Criteria map to 1:1, and the two binding technical hints: derive the channel list from Story 04's
   enum, and compute counts with a `GROUP BY`, never by fetching tickets and counting client-side.
2. `docs/design/references/14.WisalChannels/WisalChannels-LightLTR.dc.html` — **the design is built,
   contrary to the intake's note that no export exists.** Five artboards: *Admin view (Success)*,
   *Agent view (read-only)*, *Loading*, *Empty (no tickets in period)*, *Error (counts failed)*. Read the
   card grid and the period-selector segmented control. The binding copy is in the export:
   - Page title `Channels`; admin subtitle `Ticket origin by channel — no integrations connected`;
     agent subtitle `Ticket origin by channel`.
   - Admin-only notice: `Channel integrations are not available in this release.`
   - Period options: `Last 7 days` · `Last 30 days` · `Last 90 days`.
   - Per-channel status pill: `Not connected` (all five).
   - Per-channel help lines, verbatim: Email `Tickets arrive via email once an inbox is configured.`;
     WhatsApp `Requires a WhatsApp Business API account.`; Live chat `Embed a chat widget on your site
     or app.`; SMS `Requires an SMS provider (e.g. Twilio) to be configured.`; Web forms `Embed a
     contact form to collect tickets from your website.`
   - Empty per card: `No tickets this period`. Error banner: `Ticket counts couldn't load. Channel
     information is still shown.` with a `Retry` control, and each card reads `Count unavailable`.
3. `docs/design/references/14.WisalChannels/WisalChannels-LightRTL.dc.html` and the two `Dark*` files —
   the mirroring and theming reference. Port with logical properties; do not add a second stylesheet.
4. **Grep every `class="…"` in those exports against their `<style>` block before porting.** The known
   recurring export defect (`fv`/`fvd`, `sk`) is recorded in `STATUS.md`.
5. `docs/design/brief.md` — `## Required states per view`, `## Internationalization` (RTL mirrors layout,
   column order, and directional icons — not only text alignment), and `## Explicit anti-patterns`.
6. `web/src/app/navigation/navItems.tsx` — the `nav.channels` entry already exists. **Do not add one.**
7. `web/src/App.tsx` — find the `/channels` route rendering `PagePlaceholder` and replace its element.
8. `web/src/app/components/PagePlaceholder.tsx` — read it to confirm what is being removed; if `/channels`
   is its last consumer, it still stays (five other placeholder routes use it).
9. `api/app/Http/Controllers/TicketController.php` and `api/app/Policies/TicketPolicy.php` — the existing
   query-scoping pattern. The aggregate must respect the same visibility rules, not bypass them.
10. `api/routes/api.php` — where the new route registers, inside the `auth:sanctum` group.
11. `../ticket-management/04-story-ticket-management-queue.md` — read the `Channel` enum's exact case
    names and the `tickets.channel` column type it pins. **Do not restate them from memory here.**

---

## Shared contracts this story establishes

**Endpoint** `GET /api/channels/overview?period=7d|30d|90d` — `auth:sanctum`, any authenticated role.
Default `period=30d` when the parameter is absent. An unrecognised value is a 422, not a silent fallback.

Response shape (owned here; the frontend and any later integrations story cite it):

```json
{
  "data": [
    {
      "value": "email",
      "label_key": "channels.email.label",
      "status": "not_connected",
      "ticket_count": 144
    }
  ],
  "meta": {
    "period": "30d",
    "from": "2026-07-27T00:00:00Z",
    "to": "2026-08-26T00:00:00Z",
    "total_tickets": 340,
    "has_tickets": true
  }
}
```

- **`data` is always all five channels**, in the enum's declaration order, whether or not any ticket used
  them. A channel with no tickets in the period returns `ticket_count: 0`; the **frontend** renders that
  as `No tickets this period`, never as a measured zero.
- **`status` is the literal string `not_connected` for every channel in this release.** It is a field, not
  a computed health check — there is nothing to check. A later integrations story widens the value set;
  nothing in this story writes it.
- **`has_tickets`** is the empty-state signal for the screen as a whole: `false` means the period has no
  tickets at all, which is the design's *Empty* artboard.
- `label_key` follows the `labelKey` convention Story 02 established in `navItems.tsx`. Story 15
  supplies the values.

**Enum reuse rule.** The controller iterates `Channel::cases()` from Story 04. **No second channel list
exists anywhere in this codebase** — not in a constant, not in a frontend array, not in a seeder. If a
sixth channel is added to the enum, it appears on this screen with no change to this story's code, and
its help line falls back to a generic string rather than crashing.

**Frontend public surface** — `web/src/features/channels/index.ts` exports `ChannelsPage` only.

**Route** `/channels` — inside `AppLayout`, replacing the Story 02 `PagePlaceholder`.

**Period state lives in the URL** (`?period=30d`), per the shared frontend contract that filter and
pagination state are URL search params. A refresh or a shared link preserves the selected period.

---

## Implementation outline

### Backend (`api/`)

- **`app/Http/Controllers/ChannelOverviewController.php`** — a single `__invoke`. Steps: validate
  `period`; resolve it to a `from`/`to` window; run **one** aggregate query
  (`select channel, count(*) … where created_at between … group by channel`) through the same
  visibility scope `TicketController` uses; left-join the result onto `Channel::cases()` so absent
  channels come back as zero.
- **`app/Http/Requests/ChannelOverviewRequest.php`** — `period` in `7d,30d,90d`, nullable.
- **`app/Http/Resources/ChannelOverviewResource.php`** — the shape above. The help-line copy is **not**
  returned by the API; it is UI copy and belongs to the frontend catalogue.
- **`routes/api.php`** — one `Route::get('channels/overview', …)` inside the existing `auth:sanctum`
  group.
- **No migration. No model. No policy.** State this explicitly in the implementation: this story adds
  zero schema. Authorization is "any authenticated user", and the query scoping is inherited from the
  ticket visibility rules, not re-implemented.

### Frontend (`web/src/`)

- **`features/channels/`** — the standard folder shape (`api/ components/ pages/ hooks/ model/ index.ts`);
  `index.ts` is the only public surface.
- **`features/channels/api/`** — a TanStack Query hook over `lib/api.ts`, keyed on the period so
  switching periods is a cache hit on return.
- **`features/channels/model/`** — the period definitions (`7d`/`30d`/`90d`), the per-channel help-line
  and icon map keyed by the enum value, and a **generic fallback** for an enum value the map does not
  know. The map is keyed off the API's `value`, so it can never disagree with the backend list about
  *which* channels exist — only about the decorative copy for one.
- **`features/channels/components/ChannelCard.tsx`** — status pill, help line, count. The pill renders
  `Not connected` from the `status` field; it has **no** connected variant and no uptime element, so a
  future bug cannot render a fabricated healthy state.
- **`features/channels/components/PeriodSelector.tsx`** — the segmented control; writes to the URL search
  param, reads from it.
- **`features/channels/pages/ChannelsPage.tsx`** — composes all four async states:
  - **loading** → skeleton cards (per the *Loading* artboard);
  - **error** → the retryable banner with the channel list **still rendered** and each count reading
    `Count unavailable` (per the *Error* artboard) — a failed count must not blank the screen, because the
    channel information is static and did not fail;
  - **empty** (`has_tickets: false`) → each card reads `No tickets this period`;
  - **success** → counts.
- **Role branching** — the admin-only notice renders from the `role` already on `AuthContext`. It is a
  static sentence, **not** a button, link, or disclosure that opens a form. Agents see no configuration
  affordance of any kind.
- **`App.tsx`** — swap the `/channels` element from `PagePlaceholder` to `ChannelsPage`. Leave the other
  five placeholder routes untouched.
- **No change to `navItems.tsx`.** The entry exists.

---

## Edge Cases & Failure Modes

- **A ticket row with a `NULL` channel** (possible for rows created before Story 04's backfill, or
  seeded fixtures). The aggregate must not silently drop it from `total_tickets`, and it must not be
  attributed to an arbitrary channel. Count it into `meta.total_tickets` and exclude it from every
  card's `ticket_count`; the numbers then do not sum to the total, which is correct and honest.
- **A channel enum value with no help line in the frontend map.** Renders the card with a generic
  fallback line, never `undefined` and never a crash. Asserted by a test that iterates the API's
  returned values.
- **Zero tickets in the period.** `has_tickets: false` drives the Empty artboard. `0` is never rendered
  as a measured figure — this is the intake's explicit criterion and the single most likely thing to get
  wrong, because the API genuinely returns `ticket_count: 0`.
- **Counts fail but the page loads.** The channel list is static and comes from the enum, so the error
  state degrades gracefully: cards render, counts read `Count unavailable`, `Retry` refetches. Do not
  throw the whole page into an error boundary.
- **An agent crafting `?period=365d`.** 422 from the request rule. The frontend clamps an unrecognised
  URL param back to `30d` on read rather than issuing a request it knows will fail.
- **Role changes mid-session** (an admin demoted while the page is open). The notice is derived from
  `AuthContext` on render, not captured once, so the next render is correct.
- **Timezone boundary on the period window.** The window is computed **server-side** in the application
  timezone; the client sends only the period token, never dates. Two clients in different timezones
  therefore see the same numbers — which is what a shared aggregate must do.
- **Large ticket volumes.** One `GROUP BY` over an indexed `(channel, created_at)` pair. If Story 04 did
  not index `channel`, add the index in **Story 04's** territory only via the full-depth re-plan's
  findings — flag it there rather than adding a migration here.
- **Genuine uncertainty — the exact case names of Story 04's `Channel` enum.** They are not invented here
  (`email` in the sample response above is illustrative of the *shape*, not a pinned value). Read the
  enum during the full-depth re-plan and use its literal backing values.
- **Genuine uncertainty — whether ticket visibility is scoped per-agent.** `TicketPolicy` exists today,
  but whether an agent's queue is filtered to their own tickets is Story 04's decision. If it is, the
  aggregate is scoped identically, and an agent's counts will legitimately differ from an admin's.
  Confirm and state the chosen behaviour on the screen's subtitle if it is scoped.

---

## Test Plan

Backend (Pest, matching `api/tests/Feature/`):

1. **`tests/Feature/Channels/ChannelOverviewTest.php`** — the endpoint returns **all five** channels even
   when only one has tickets; counts match seeded rows; `period=7d` and `period=90d` return different
   windows; an absent `period` defaults to `30d`; `period=365d` is 422.
2. **`tests/Feature/Channels/ChannelOverviewEmptyTest.php`** — with zero tickets in the window, every
   `ticket_count` is `0` **and** `meta.has_tickets` is `false`; with tickets outside the window only, the
   same holds.
3. **`tests/Feature/Channels/ChannelOverviewAuthTest.php`** — unauthenticated is 401; every role
   (agent, team lead, administrator) receives 200 and the **same** `status: "not_connected"` for all
   five; no route exists that writes channel configuration.
4. **Enum-drift guard** — a test asserting the response's `data` length and values equal
   `Channel::cases()`, so adding a case to the enum without touching this controller still passes and
   *removing* the enum's use here fails.
5. **`tests/Feature/ApiContractTest.php`** (existing) — extend with the new route inside `auth:sanctum`.

Frontend (Vitest + Testing Library):

6. **`src/features/channels/pages/ChannelsPage.test.tsx`** — the four async states each render their
   artboard; the error state still lists five channels and shows a working `Retry`; the empty state shows
   `No tickets this period` and **no** literal `0` in any card.
7. **`src/features/channels/pages/ChannelsPage.roles.test.tsx`** — as an administrator the release notice
   is present; as an agent it is absent **and** no button, link, or form control exists anywhere on the
   page (asserted by querying for every role that would imply configuration, not by eyeballing).
8. **`src/features/channels/components/PeriodSelector.test.tsx`** — selecting a period writes
   `?period=` to the URL; loading the page with `?period=90d` preselects it; `?period=nonsense` falls
   back to `30d` without a request.
9. **Nav-integrity regression** — Story 02's `it.each(navItems)` route test must still pass, now
   resolving `/channels` to `ChannelsPage` rather than a placeholder. **If that test needs changing, the
   change is wrong.**
10. **Manual only** — dark mode and RTL mirroring. jsdom does not resolve computed CSS.

---

## Verification Steps

1. **Backend tests pass:** `php artisan test` in `api/` — new suites green, every pre-existing test green.
2. **Route audit:** `php artisan route:list --path=channels` in `api/` — exactly one `GET` route, inside
   `auth:sanctum`, and **no** `POST`/`PATCH`/`DELETE`.
3. **Frontend typechecks and lints:** `npm run build` and `npm run lint` in `web/` — zero errors.
4. **Frontend tests pass:** `npx vitest run` in `web/` — new suites green, Story 02's shell and nav
   suites unchanged.
5. **No second channel list:** `grep -rn "whatsapp" api/app web/src --include=*.php --include=*.ts --include=*.tsx -i`
   — the only hits are Story 04's enum, this story's frontend copy map, and tests. No parallel list.
6. **Manual:** `php artisan serve` + `npm run dev`. Sign in as `agent@wisal.test`, click **Channels** in
   the sidebar — a real screen renders, read-only, five cards, all `Not connected`. Switch the period and
   confirm the URL updates and the counts change. Sign in as `admin@wisal.test` and confirm the release
   notice appears and is not clickable. Set `<html dir="rtl">` and confirm the card grid and the period
   control mirror with no horizontal scrollbar.

---

## Done Criteria

- [ ] Activating the **Channels** nav item navigates to a real, rendered screen — no nav item in the shipped product leads to a placeholder or nowhere; Story 02's `it.each(navItems)` route test passes unchanged.
- [ ] The screen lists the five channels of client requirement category 3 — Email, WhatsApp, Live chat, SMS, Web forms — each with an explicit connection status, derived from Story 04's `Channel` enum.
- [ ] Every channel reads unambiguously as **Not connected**. No fabricated "Connected" value, no uptime figure, and no mocked health indicator exists in the markup, the API, or the component's variant set.
- [ ] Per-channel ticket counts for a selectable period are computed from real ticket rows by a single `GROUP BY` aggregate — never by fetching tickets and counting client-side.
- [ ] With zero tickets in the selected period, the screen renders an Empty state rather than zeros presented as a measurement.
- [ ] An Agent sees an entirely read-only screen with no configuration affordance of any kind.
- [ ] An Administrator sees a plain statement that integration is not available in this release — a sentence, not a form that cannot work.
- [ ] The screen mirrors under RTL using logical properties and themes consistently with the rest of the shell in both light and dark, with no second stylesheet.
- [ ] While loading, the screen shows a skeleton; on failure it shows a retryable error that still renders the channel list with `Count unavailable`.
- [ ] No migration, no table, and no write endpoint were added by this story.
- [ ] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 15.**
