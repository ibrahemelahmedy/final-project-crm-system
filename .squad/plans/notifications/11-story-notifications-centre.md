# Story 11 — Notifications Centre (in-app) (Story: WIS-13)

> **Contract-level plan.** Stories 01–02 are implemented; this story executes after Story 10.
> Scope, contracts, and acceptance criteria below are final. Task-level file paths and line
> ranges are deliberately absent — regenerate this plan at full depth (`/squad-plan` on the same
> intake) immediately before implementing, once the code it builds on exists.

## Prerequisites

- **Story 01 completed** (`../authentication/01-story-authentication-access-control.md`) — supplies
  Sanctum auth, `App\Enums\UserRole`, and `AuthContext`. Every notification query is scoped to
  `auth()->user()`; there is no cross-user read path.
- **Story 02 completed** (`../app-shell/02-story-application-shell-navigation.md`) — **supplies the
  header bell slot this story fills.** Story 02 shipped it inert on purpose: a
  `<button className="shell-icon-btn" disabled title="Coming soon" aria-label="Notifications">`
  carrying a `{/* Notification slot — behaviour owned by WIS-13. */}` comment, with a
  `<span className="shell-notification-dot" aria-hidden="true" />` inside it. Story 02's own Done
  Criteria require that dot to be `aria-hidden` precisely because no code produced a count yet.
  **This story fills that slot; it does not restructure the header.**
- **Story 04** (`../ticket-management/04-story-ticket-management-queue.md`) — owns the `tickets`
  table and the `TicketPolicy` visibility rules that decide whether a notification's source record
  is still visible to its recipient. Consumed, not redefined.
- **Story 06** (`../sla-rules-automation/06-story-sla-rules-automation.md`) — **producer.** Owns
  `first_response_due_at`, `resolution_due_at`, and the SLA-risk computation; it calls this story's
  dispatcher to emit `sla_at_risk` and `sla_breached`.
- **Story 08** (`../users-roles-admin/08-story-users-roles-administration.md`) — owns user
  deactivation. The dispatcher must drop delivery to a deactivated account.
- **Story 10** (`../agent-productivity/10-story-agent-productivity.md`) — **producer.** Emits
  `mention` and `task_due`.
- **Buildable with Story 06 alone.** If Story 10 slips, this story ships against the SLA producer
  only. The notification `type` is an **open string column** backed by a PHP enum registry, so
  Story 10's types drop in **without a schema change**.

---

## Story Goal

1. Every notification-generating event **persists a row** for its target user. A user who is
   offline when an SLA breaches still sees it on next login — nothing is pushed to a live session
   and forgotten.
2. The App Shell header bell shows an **unread count derived from the server**, correct after a
   full page refresh, never client-only state.
3. Opening the bell shows a panel of recent notifications with read/unread state and a
   **"Mark all as read"** action; activating a row navigates to its source record and marks it read
   as a consequence of that navigation.
4. A full `/notifications` page (the panel's "View all notifications" link) lists notifications
   **paginated server-side** and filterable by read/unread.

**Delivery-mechanism decision (documented, not omitted):** MVP is **polling**, not WebSocket push.
The unread-count query refetches on a fixed interval and on window focus; the panel refetches when
opened. Real-time push is a deliberate later enhancement, not an oversight. The persistence-first
design above is what makes polling sufficient.

**Storage decision (documented):** a **first-class domain `notifications` table**, not Laravel's
built-in polymorphic notifications table. Framework class names must never leak into the API
contract as `type` values — the API's `type` is a product domain event.

**Out of scope.** Outbound delivery by email, SMS, or WhatsApp (a later category-11 integrations
story). Real-time WebSocket push (see decision above). Per-user notification preferences — muting
types or digest schedules — deferred until there is evidence of volume being a problem.

---

## Context — Read These Files First

Every path below was verified to exist at plan time.

1. `docs/design/references/12.WisalNotifications/` — four artboards (Light/Dark × LTR/RTL).
   `WisalNotifications-LightLTR.dc.html` carries **five compositions on one board**, all of which
   must be built:
   - **Bell states**, labelled `Bell states (no unread / 3 unread / 9+ unread)` — read the three
     badge treatments, including the `9+` overflow.
   - **Success (panel open)** — header row `Notifications` + `Mark all as read`; rows typed
     `SLA at risk`, `Mention`, `Task due`, `SLA breached`, `Mention`; relative timestamps
     (`12 min ago`, `35 min ago`, `1 hr ago`, `3 hr ago`) that switch to an absolute date
     (`Aug 24`) past a threshold; footer link **`View all notifications`**.
   - **Loading state**, **Empty state** (`You're all caught up` / "No notifications right now —
     check back later."), and **Error state** (`Couldn't load notifications` / "Check your
     connection and try again." / `Retry`).
   Read the RTL artboard for the panel's anchoring side and the badge's mirrored position.
2. `docs/design/references/1.app-shell/WisalAppShell-LightLTR.dc.html` and its
   `-DarkLTR` / `-LightRTL` / `-DarkRTL` siblings — the header the bell sits in. The panel must
   align to the existing header control row; **do not re-lay-out the header.**
3. `web/src/app/layouts/AppLayout.tsx` — read the header control block. The Notifications button and
   its `shell-notification-dot` span sit immediately after the inert Language button
   (`aria-label="Language"`, owned by Story 15). **Only these two elements change:** the button
   loses `disabled` and `title="Coming soon"` and gains a popup relationship; the dot becomes a
   count badge. Nothing above or below it is touched.
4. `web/src/index.css` — the `shell-icon-btn` and `shell-notification-dot` rules, and the shell
   token set. The badge and panel derive from these tokens.
5. `.squad/plans/app-shell/02-story-application-shell-navigation.md` — read the "Notification slot"
   task and the Done Criteria line that names **WIS-13** as the slot's owner. Read the keyboard
   verification step too: Story 02 required the inert control to be skipped or announced as
   disabled, never focusable-but-dead. This story makes it a real, focusable, operable control.
6. `docs/design/brief.md` — "Required states per view" (~lines 181–188) and "Accessibility"
   (~lines 189–198): focus states always visible, colour is never the only signal. An unread row is
   marked by more than colour.
7. `.squad/stories/notifications/WIS-13/intake.md` — acceptance criteria transcribed to Done
   Criteria below 1:1.
8. `api/routes/api.php` — the existing `auth:sanctum` route group; the notification routes append
   inside it.
9. **Regenerate-time reads** (do not exist yet): Story 04's `TicketPolicy` view rules and ticket
   route shape; Story 06's SLA evaluation job, which is the first caller of the dispatcher;
   Story 08's user-deactivation flag.
10. **Known export defect** — grep every `class="..."` in the `.dc.html` artboards against their
    `<style>` block before porting CSS (`fv`/`fvd`, `sk` recur with no rule defined).

---

## Shared contracts this story establishes

Later stories and both producers cite these; they do not redefine them.

**Table owned here** — `notifications`:

`id`, `user_id` (recipient), `type` (string), `title`, `body` (nullable), `source_type` (nullable),
`source_id` (nullable), `link_to` (nullable string — the SPA route), `read_at` (nullable),
`created_at`, `updated_at`.
**Index on `(user_id, read_at)`** — the unread-count query runs on every page load for every user.
Second index on `(user_id, created_at)` for the paginated list.

**Enum owned here** — `App\Enums\NotificationType`, the canonical registry:

| Case | Value | Producer |
|---|---|---|
| `SlaAtRisk` | `sla_at_risk` | Story 06 |
| `SlaBreached` | `sla_breached` | Story 06 |
| `Mention` | `mention` | Story 10 |
| `TaskDue` | `task_due` | Story 10 |

The column is a **plain string**, so a new case is a code change with no migration. The enum
carries `label()` and the icon/tone key the panel renders. **Framework class names are never
`type` values.**

**Producer contract owned here** — `App\Services\NotificationDispatcher`:

```php
public function dispatch(
    User $recipient,
    NotificationType $type,
    string $title,
    ?string $body = null,
    ?Model $source = null,
    ?string $linkTo = null,
): ?Notification;
```

It is the **only** way a notification is created. It returns `null` and writes nothing when the
recipient is deactivated. Stories 06 and 10 call it; neither inserts into the table directly.

**API endpoints owned here** (all inside the `auth:sanctum` group, all scoped to the caller):

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/notifications` | server-side paginated; `?filter=unread\|all`, `?page=` |
| `GET` | `/api/notifications/unread-count` | returns `{ "count": int }`; the bell's only source |
| `POST` | `/api/notifications/{notification}/read` | idempotent |
| `POST` | `/api/notifications/read-all` | idempotent; affects only the caller's rows |

`NotificationResource` exposes `id`, `type`, `type_label`, `title`, `body`, `link_to`, `read_at`,
`created_at`, and a computed **`source_available: bool`** — false when the source record was
deleted or fails the recipient's policy check. The client renders the "no longer available" state
from this flag; it never discovers unavailability by following a link into a 403/404.

**Frontend public surface** — `web/src/features/notifications/index.ts` exports
`NotificationBell`, `useUnreadCount`, and `NotificationsPage`. Nothing else is importable from
outside the folder. **`NotificationBell` is the only thing `AppLayout.tsx` imports.**

**Routing** — a new route `/notifications` in `web/src/App.tsx`, inside the authenticated
`AppLayout` group, no role restriction. **No `navItems.tsx` change** — the design reaches this page
through the panel's "View all notifications" link, not the sidebar.

---

## Implementation outline

### Backend

- **Migration** creating `notifications` with both indexes above.
- **`App\Models\Notification`** with a `belongsTo(User::class)`, a `morphTo` source, and query
  scopes `forUser()` and `unread()`.
- **`App\Enums\NotificationType`** as specified above.
- **`App\Services\NotificationDispatcher`** — the single write path, with the deactivated-recipient
  guard inside it so no producer can bypass the rule.
- **`NotificationController`** — `index`, `unreadCount`, `markRead`, `markAllRead`. Every action
  filters by `auth()->id()`; `markRead` on another user's row is a **404, not a 403** (a 403 would
  confirm the row exists).
- **`NotificationResource`** — computes `source_available` by resolving the morph target and running
  the recipient's policy check for it. A soft-deleted or policy-failing source yields `false` and
  the resource **omits `link_to`** so the client cannot navigate at all.
- **Routes** appended to `api/routes/api.php` inside the existing `auth:sanctum` group.
- **Idempotency** — `markRead` and `markAllRead` set `read_at` only where it is currently null, so a
  second call is a no-op and does not rewrite timestamps.
- **No changes required** to `TicketController`, `AuthenticatedSessionController`, or any Story 04
  file. This story is additive on the backend.

### Frontend

- **`web/src/features/notifications/`** with `api/ components/ pages/ hooks/ model/ index.ts` per
  the shared folder contract.
- **`useUnreadCount`** — a TanStack Query hook over `/api/notifications/unread-count` with a fixed
  `refetchInterval` and `refetchOnWindowFocus: true`. **Server state; it does not live in a global
  store.** The global store holds user and theme only.
- **`NotificationBell`** — the trigger plus the popup panel. It renders the badge from
  `useUnreadCount` (hidden at zero, `9+` above nine, with an accessible label such as
  "Notifications, 3 unread" so the count is not colour- or shape-only). The panel is a
  `aria-haspopup` / `aria-expanded` popup with a focus trap, `Escape` to close, and focus returning
  to the bell — mirroring the sidebar drawer behaviour Story 02 already established.
- **`AppLayout.tsx` edit — the minimum possible.** Replace the inert button and its dot span with
  `<NotificationBell />`, and delete the `{/* Notification slot — behaviour owned by WIS-13. */}`
  comment now that the owner has landed. **The Language slot beside it, the header grid, the search
  block, the New Ticket button, and the user menu are untouched.**
- **Panel rows** — type icon and tone from `type_label`/`type`, title, relative timestamp with the
  absolute-date fallback, and an unread marker that is **not colour alone**. A row with
  `source_available: false` renders a non-navigating "No longer available" treatment and still
  offers mark-as-read.
- **Activation** — clicking a row issues the `read` mutation and navigates to `link_to`, then
  invalidates both the unread-count and list queries. Optimistic update on the badge with rollback
  on failure.
- **`NotificationsPage`** at `/notifications` — the full list, server-paginated, with the
  read/unread filter held in **URL search params**, plus all four async states.
- **All four async states** on both the panel and the page, taken from the artboards.

---

## Edge Cases & Failure Modes

- **Zero notifications.** The panel shows the Empty state ("You're all caught up"), never a blank
  panel. The badge is hidden entirely, not rendered as `0`.
- **Unread count above nine.** The badge renders `9+` per the artboard; the accessible label still
  announces the exact number.
- **Count stale after an action in another tab.** `refetchOnWindowFocus` plus the fixed interval
  bound the staleness. The count is server-derived on every fetch, so a full page refresh is always
  correct — that is the acceptance criterion, and polling satisfies it.
- **Source record deleted or no longer visible.** `source_available` is false, `link_to` is omitted,
  and the row renders "no longer available". The user never sees a raw 404, and never learns
  anything about a record they may not see.
- **`mark all as read` run twice.** Second run affects zero rows and returns the same result — the
  `where read_at is null` clause makes it idempotent.
- **`mark all as read` and another user's rows.** Impossible: the query is scoped to
  `auth()->id()` with no request-supplied user parameter.
- **Deactivated recipient.** The dispatcher writes nothing. Rows created before deactivation stay in
  the table but are unreachable, because every read path requires an authenticated session.
- **Notification created for a user whose session is open.** Nothing is pushed; the next poll picks
  it up. This is the documented MVP behaviour, not a bug.
- **Concurrent read of the same row from panel and page.** `markRead` is idempotent; the second
  write is a no-op and the invalidation reconciles both views.
- **RTL and dark.** The badge mirrors to the opposite corner and the panel anchors to the opposite
  edge, driven by `UiPreferencesContext` direction — verified against the `-DarkRTL` artboard, not
  by a separate stylesheet.
- **Reduced motion.** The panel open/close transition respects `prefers-reduced-motion`, per the
  brief's accessibility rules.
- **Stated uncertainty.** The exact refetch interval is **not** pinned here. Pick it at
  regeneration against the observed producer volume from Stories 06 and 10; anything from 30 to 120
  seconds satisfies the acceptance criteria, and the choice must be a named constant with a comment,
  not a literal buried in a hook.
- **Stated uncertainty.** Whether `link_to` is stored at dispatch time or derived from
  `source_type`/`source_id` at read time depends on how Story 04 shapes its ticket routes. Storing
  it is the plan's default; if Story 04's route shape proves unstable, derive it instead. Decide
  once, at regeneration, and apply it to both producers.

---

## Test Plan

Backend tests are Pest feature tests under `api/tests/Feature/`, following
`api/tests/Feature/TicketScopeTest.php` for the scoping pattern and
`api/tests/Feature/ApiContractTest.php` for response-shape assertions. Frontend tests are Vitest +
Testing Library against `web/src/test/setup.ts`.

1. `api/tests/Feature/NotificationDispatchTest.php` — the dispatcher persists a row for the
   recipient; a **deactivated** recipient gets nothing; the row survives with no session ever
   opened (the offline-user criterion).
2. `api/tests/Feature/NotificationScopeTest.php` — `GET /api/notifications` returns only the
   caller's rows; `markRead` on another user's row returns **404**; `read-all` leaves other users'
   rows untouched.
3. `api/tests/Feature/NotificationIdempotencyTest.php` — `read-all` twice produces identical state
   and does not rewrite `read_at`; `markRead` on an already-read row is a no-op 200.
4. `api/tests/Feature/NotificationPaginationTest.php` — the index is paginated server-side (asserts
   the meta block and that a large seed is **not** returned in full); `?filter=unread` returns only
   unread rows.
5. `api/tests/Feature/NotificationUnreadCountTest.php` — the count matches the row count after
   dispatch, after one `markRead`, and after `read-all`; it is computed server-side on each call.
6. `api/tests/Feature/NotificationSourceAvailabilityTest.php` — a notification whose source ticket
   was deleted returns `source_available: false` and **omits `link_to`**; so does one whose source
   fails the recipient's `TicketPolicy` check.
7. `api/tests/Feature/NotificationTypeContractTest.php` — every value returned in `type` is a case
   of `App\Enums\NotificationType`; **no response field contains a PHP class name.**
8. `web/src/features/notifications/components/NotificationBell.test.tsx` — the badge is hidden at
   zero, shows the exact number below ten, shows `9+` above nine, and announces the exact count to
   assistive technology; `Escape` closes the panel and returns focus to the bell.
9. `web/src/features/notifications/components/NotificationPanel.test.tsx` — the four async states
   render from the artboards; activating a row fires the read mutation **and** navigates; a row with
   `source_available: false` renders "no longer available" and does not navigate.
10. `web/src/app/layouts/AppLayout.test.tsx` (**extend the existing Story 02 test, do not replace
    it**) — the header still renders the same control set in the same order, the Language slot is
    still inert, and the Notifications control is now enabled with no `title="Coming soon"`. This is
    the regression guard on "must not restructure the header".

---

## Verification Steps

1. **Backend migrates:** `cd api && php artisan migrate:fresh --seed` — the `notifications` table
   and both indexes are created without error.
2. **Backend tests pass:** `cd api && ./vendor/bin/pest` — new tests green; existing
   `ApiContractTest`, `TicketScopeTest`, and the `Auth/` suite still green.
3. **Frontend tests pass:** `cd web && npx vitest run` — new tests green, and the extended
   `AppLayout` test proves the header is unchanged. (There is **no `test` script** in
   `web/package.json`.)
4. **Lint clean:** `cd web && npm run lint` — no new oxlint findings.
5. **Build clean:** `cd web && npm run build` — `tsc -b` passes with no type errors.
6. **Regression, manual:** `cd web && npm run dev`; sign in, trigger an SLA notification via
   Story 06's command, and confirm the badge appears **without a page refresh within one poll
   interval** and is still correct **after a hard refresh**. Open the panel, activate a row, confirm
   navigation and that the badge decrements. Run "Mark all as read" twice.
7. **Direction and theme:** toggle theme and direction from the header and confirm the badge and
   panel mirror and theme against the `-DarkRTL` artboard.

---

## Done Criteria

- [ ] Every notification-generating event (SLA at-risk/breached from Story 06; mention and task-due
      from Story 10) **persists a row** for the target user; a user offline at the moment of an SLA
      breach sees it on next login.
- [ ] The header bell shows an unread count that is correct after a **full page refresh** and is
      **server-derived**, never client-only state.
- [ ] Activating a notification navigates to the source record and marks it read as a result of that
      navigation.
- [ ] The notification list is **paginated server-side** and filterable by read/unread; the table is
      never fetched in full.
- [ ] "Mark all as read" affects only the caller's notifications, and running it twice produces the
      same result as running it once.
- [ ] A user with zero notifications sees the Empty state ("You're all caught up"), not a blank
      panel.
- [ ] A notification whose source was deleted or is no longer visible under the role model renders a
      clear "no longer available" state — never a raw 404, never a leak.
- [ ] Nothing is delivered to a deactivated account (Story 08).
- [ ] The bell and panel mirror correctly in RTL and theme correctly in both themes, consistently
      with the rest of the shell.
- [ ] **The Story 02 header is not restructured** — only the notification button and its dot are
      replaced, proven by the extended `AppLayout` test.
- [ ] The `type` contract exposes product domain events only; no framework class name appears in any
      API response.
- [ ] Polling (not WebSocket push) is stated in the plan and in a code comment as a deliberate MVP
      decision.
- [ ] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 12.**
