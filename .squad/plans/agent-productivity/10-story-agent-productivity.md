# Story 10 — Agent Productivity — Quick Replies, Tasks & Internal Collaboration (Story: WIS-12)

> **Contract-level plan.** Stories 01–02 are implemented; this story executes after Story 09.
> Scope, contracts, and acceptance criteria below are final. Task-level file paths and line
> ranges are deliberately absent — regenerate this plan at full depth (`/squad-plan` on the same
> intake) immediately before implementing, once the code it builds on exists.

## Prerequisites

- **Story 01 completed** (`../authentication/01-story-authentication-access-control.md`) — supplies
  `App\Enums\UserRole` (`agent`, `team_lead`, `administrator`), Sanctum auth, `AuthContext`,
  and `RequireAuth` with its `roles` prop. The mention-authorization rule reads this role model.
- **Story 02 completed** (`../app-shell/02-story-application-shell-navigation.md`) — supplies
  `web/src/app/layouts/AppLayout.tsx`, the `navItems.tsx` manifest this story appends to, and
  `UiPreferencesContext` (theme + direction). No screen implements its own theme toggle.
- **Story 04** (`../ticket-management/04-story-ticket-management-queue.md`) — owns the expanded
  `tickets` table and the `Priority` / `TicketStatus` / `Channel` enums. This story reads them and
  **redefines none of them**. It also owns the ticket-close transition that this story hooks.
- **Story 05** (`../conversation-thread/05-story-conversation-thread.md`) — owns the
  `ticket_messages` table, the chronological thread renderer, and the reply composer.
  **This story does not create that table.** It adds a `visibility` column to it via its own
  migration and adds a composer mode; it never edits Story 05's migration.
- **Story 06** (`../sla-rules-automation/06-story-sla-rules-automation.md`) — owns the queue +
  scheduler infrastructure (`routes/console.php` schedule entries, the queued-job pattern for SLA
  breach checks). Task reminders **reuse that infrastructure**; they do not add a second
  scheduling mechanism.
- **Story 11** (`../notifications/11-story-notifications-centre.md`) — owns the `notifications`
  table, `App\Enums\NotificationType`, and the dispatcher service. This story is a **producer**:
  it emits the `mention` and `task_due` types and displays nothing itself.
- **Coordination:** Story 07 (Agent Dashboard) consumes `GET /api/tasks` and the quick-reply
  picker component from this story. Build 10 before or alongside 07.

---

## Story Goal

1. A Team Lead or Administrator manages a **shared library of quick replies** (canned responses)
   at `/quick-replies` — create, edit, archive, filter by category and status.
2. An Agent composing a reply in the Conversation Thread opens a **quick-reply picker**, searches
   it, and inserts a template. The inserted text lands in the composer **fully editable** and is
   never sent automatically. Placeholders resolve against the current ticket and customer
   server-side.
3. An agent creates **tasks with a due date and an assignee** on a ticket, sees them in a Tasks
   panel on the ticket detail, and completes them. A scheduled job fires an in-app reminder to the
   assignee when a task falls due.
4. An agent adds an **internal note** to a ticket. It renders in the same chronological thread,
   visually distinct, and is **never** included in any customer-facing path. Notes support
   `@mentions` that notify the mentioned colleague and are recorded in ticket history.

**Ownership decision (documented, not implicit):** quick replies are a **shared team library
only**. There is **no personal/agent scope in this story**. Agents are read-only consumers of the
library; create/edit/archive is Team Lead and Administrator. This follows the design export, whose
empty state reads "Your team lead can create canned responses in Admin → Quick Replies" and whose
header reads "18 templates in the shared library". A `scope` column is **not** added — adding
personal scope later is a new migration plus a policy change, not a rework.

**Closed-ticket-with-open-tasks decision (documented):** **warn, then auto-cancel.** The ticket
close action warns "N open task(s) on this ticket will be cancelled", and on confirmation the
tasks transition to `cancelled` with `cancel_reason = 'ticket_closed'`. Cancelled tasks generate no
reminders. An orphaned reminder for a closed ticket is therefore impossible by construction.

**Out of scope.** AI-suggested replies (a later category-7 story) — templates here are
human-authored only. Real-time presence or typing indicators. Outbound email/SMS delivery of a
mention or reminder — delivery is in-app only, through Story 11. Shared team inboxes or
ticket-watching by non-assigned agents. Per-agent personal quick replies (see decision above).

---

## Context — Read These Files First

Every path below was verified to exist at plan time.

1. `docs/design/references/8.WisalQuickReplies/` — seven artboards for the admin library screen:
   `WisalQuickReplies-LightLTR.dc.html` (success), plus `-Loading`, `-Empty`, `-Error`,
   `-EditModal`, `-BulkSelected`, `-ArchiveConfirm`. Read the success artboard for the table
   columns: **TITLE · PREVIEW · CATEGORY · STATUS · LAST UPDATED · ACTIONS**, the
   `Category: All` / `Status: All` filter chips, and the `Showing 1–5 of 18` pagination footer.
   **Note this folder ships LTR/light only** — the RTL and dark variants must be derived from
   `web/src/index.css` tokens and the shell's direction handling, not invented.
2. `docs/design/references/9.WisalQuickReplyPicker/` — four artboards (Light/Dark × LTR/RTL) for
   the in-composer picker. Read the keyboard legend (`↑↓ navigate · Enter insert · Esc close`), the
   category badges (`BILLING`, `GENERAL`), the two distinct empty states ("No replies match …" vs
   "No quick replies yet"), and the post-insert affordance
   **"Inserted from quick replies · still editable"**.
3. `docs/design/references/10.WisalTicketTasks/` — four artboards. Read the due-state labels the UI
   must produce: **`Overdue · yesterday`**, **`Due soon · in 2 hours`**, **`In 2 days · Aug 27`**,
   **`Completed · Aug 24`**; and the Add-task form fields: **Task · Due date & time · Assignee**
   (default `Sarah Ahmed (me)`).
4. `docs/design/references/11.WisalInternalNote/` — four artboards. Read the composer mode toggle
   (**"Reply to customer" | "Internal note"**), the `Not visible to customer` banner, the
   `Internal only · agents see this` footer, the `@mention` autocomplete panel (`COLLEAGUES`
   heading, name + `Role · Team` secondary line), and the send-failed artboard where **the note
   text is preserved and a Retry is offered**.
5. `.squad/stories/agent-productivity/WIS-12/intake.md` — acceptance criteria are transcribed to
   Done Criteria below 1:1.
6. `docs/design/brief.md` — "Required states per view" (~lines 181–188): all four async states are
   mandatory; destructive actions add a confirmation naming the specific record. Also
   "Explicit anti-patterns" (~lines 208–221): **do not fragment a ticket's history** — internal
   notes belong in the one chronological thread.
7. `web/src/app/navigation/navItems.tsx` — read the `NavItemDef` type (`labelKey`, `label`, `to`,
   `icon`, `roles?`, `group`) and the `icon()` helper. The Quick Replies entry is appended here,
   `group: 'admin'`, never hard-coded in a component.
8. `api/app/Enums/UserRole.php` — the three cases and `label()`. Mention authorization and quick
   reply write-authorization both branch on these.
9. **Regenerate-time reads** (these files do not exist yet; the named story creates them):
   the `ticket_messages` migration and message model from Story 05; the `Ticket` model's close
   transition and `TicketStatus` enum from Story 04; the scheduler wiring in `routes/console.php`
   from Story 06; `App\Services\NotificationDispatcher` and `App\Enums\NotificationType` from
   Story 11.
10. **Known export defect** — grep every `class="..."` in the `.dc.html` artboards against their
    `<style>` block before porting CSS. Classes `fv`/`fvd` (focus-visible) and `sk` (skeleton) are
    referenced in markup with no rule defined in several exports.

---

## Shared contracts this story establishes

Later stories cite these; they do not redefine them.

**Tables owned here**

- `quick_replies` — `id`, `title`, `body` (template text, contains `{{…}}` placeholders),
  `category` (string), `status` (`active` | `archived`), `created_by`, `updated_by`, timestamps.
- `ticket_tasks` — `id`, `ticket_id`, `title`, `due_at` (nullable), `assignee_id`, `created_by`,
  `status` (`open` | `completed` | `cancelled`), `completed_by`, `completed_at`, `cancel_reason`
  (nullable), `reminded_at` (nullable — the idempotency guard for the reminder job), timestamps.
  Index on `(assignee_id, status, due_at)`; index on `(ticket_id, status)`.
- `ticket_message_mentions` — `id`, `ticket_message_id`, `mentioned_user_id`, `created_at`.
  Unique on `(ticket_message_id, mentioned_user_id)`.
- **Column added to Story 05's `ticket_messages`** via a new migration
  (`add_visibility_to_ticket_messages_table`): `visibility` string, **not null, default `public`**.
  Story 05's own migration is **not edited**.

**Enums owned here** (`api/app/Enums/`)

- `MessageVisibility`: `Public = 'public'`, `Internal = 'internal'`.
- `TaskStatus`: `Open = 'open'`, `Completed = 'completed'`, `Cancelled = 'cancelled'`.
- `QuickReplyStatus`: `Active = 'active'`, `Archived = 'archived'`.

**API endpoints owned here**

| Method | Path | Who |
|---|---|---|
| `GET` | `/api/quick-replies` | any authenticated user (list; supports `category`, `status`, `page`) |
| `POST` | `/api/quick-replies` | team_lead, administrator |
| `PATCH` | `/api/quick-replies/{quickReply}` | team_lead, administrator |
| `POST` | `/api/quick-replies/{quickReply}/archive` | team_lead, administrator |
| `GET` | `/api/tickets/{ticket}/quick-replies` | any user who can view the ticket — returns **active only**, each row carrying both `body_template` and `body_rendered` |
| `GET` | `/api/tickets/{ticket}/tasks` | ticket viewers |
| `POST` | `/api/tickets/{ticket}/tasks` | ticket viewers |
| `PATCH` | `/api/tasks/{task}` | task assignee, creator, team_lead, administrator |
| `POST` | `/api/tasks/{task}/complete` | same as PATCH |
| `GET` | `/api/tasks?assignee=me&status=open` | self — **the contract Story 07's dashboard consumes** |
| `GET` | `/api/tickets/{ticket}/mentionable-users` | ticket viewers — users who pass `TicketPolicy::view` for that ticket |

Internal notes are **not a new endpoint**: Story 05's `POST /api/tickets/{ticket}/messages` gains a
`visibility` field (`public` | `internal`, default `public`) and an optional `mentions: int[]`.

**Placeholder vocabulary** (server-side, resolved by `App\Services\QuickReplyRenderer`)

`{{customer.first_name}}` · `{{customer.full_name}}` · `{{ticket.id}}` · `{{ticket.subject}}` ·
`{{agent.first_name}}`. An unresolvable placeholder is **echoed literally** in the rendered output
(`{{customer.first_name}}` stays on screen) — it is never replaced with an empty string. Rendering
lives in the service, never in the React composer, so a future automated/scheduled context reuses it.

**Notification types produced** (defined by Story 11, emitted here): `mention`, `task_due`.

**Frontend public surface** — `web/src/features/agent-productivity/index.ts` exports
`QuickReplyPicker`, `TicketTasksPanel`, `useMyOpenTasks`, and `QuickRepliesPage`. Nothing else is
importable from outside the folder.

---

## Implementation outline

### Backend

- **Migrations** — one per table listed above, plus the `visibility` column migration on
  `ticket_messages`. All new columns on an existing table are **nullable or defaulted** so the
  migration is safe on populated data.
- **Models** — `App\Models\QuickReply`, `App\Models\TicketTask`. Mention rows are a relation on
  Story 05's message model, added from this story's own model file where possible rather than by
  editing Story 05's model beyond the one relation method.
- **Policies** — `QuickReplyPolicy` (write = team_lead/administrator; read = any authenticated),
  `TicketTaskPolicy` (assignee, creator, team_lead, administrator). Both registered alongside
  the existing `TicketPolicy`.
- **`App\Services\QuickReplyRenderer`** — owns the placeholder vocabulary and the
  echo-literal-on-unresolvable rule. Pure; takes a `QuickReply`, a `Ticket`, and the acting user.
- **`App\Services\MentionResolver`** — parses `@` tokens out of a note body against the submitted
  `mentions` id list, and rejects any id that fails `TicketPolicy::view` for that ticket. Rejection
  is a **422 naming the specific user and reason**, not a silent drop.
- **Controllers** — `QuickReplyController`, `TicketQuickReplyController`, `TicketTaskController`,
  `TaskController`, `MentionableUserController`. Routes appended to `api/routes/api.php` inside the
  existing `auth:sanctum` group.
- **Resources** — `QuickReplyResource`, `TicketTaskResource` (exposes a computed `due_state` of
  `overdue` | `due_soon` | `upcoming` | `none` so the client never re-derives it), `TaskUserResource`.
- **Server-side visibility split** — Story 05's message index endpoint and any customer-facing
  render path filter `visibility = public` **in the query**, not in the view layer. A global scope
  or a dedicated `publicOnly()` query scope on the message model is the enforcement point.
- **Scheduled reminder** — an artisan command (`tasks:dispatch-due-reminders`) registered in
  `routes/console.php` **next to Story 06's SLA schedule entry**, running every five minutes. It
  selects `ticket_tasks` where `status = open`, `due_at <= now()`, `reminded_at IS NULL`, calls
  Story 11's dispatcher with type `task_due`, and stamps `reminded_at` in the same transaction.
- **Ticket-close hook** — on the close transition owned by Story 04, cancel open tasks with
  `cancel_reason = 'ticket_closed'`. The count of tasks about to be cancelled is returned by the
  close endpoint's pre-check so the UI can warn.
- **Ticket history** — a mention writes a history entry through Story 04's ticket-history
  mechanism. This story adds the entry type; it does not build a second history log.

### Frontend

- **`web/src/features/agent-productivity/`** with `api/ components/ pages/ hooks/ model/ index.ts`
  per the shared folder contract. Server state → TanStack Query. Filter and pagination state →
  URL search params. Zod schemas are the single source for both form types and validation.
- **`QuickRepliesPage`** — the admin library table, built from the `8.WisalQuickReplies` artboards,
  with all four async states plus the archive confirmation naming the specific template.
- **Route + nav** — a new route `/quick-replies` in `web/src/App.tsx`, wrapped in
  `RequireAuth roles={['team_lead','administrator']}` (matching the existing `/sla-rules` and
  `/users` pattern), and a new entry in `navItems.tsx` with `group: 'admin'`. **Client-side role
  filtering is a UX affordance, not the gate** — the policy is.
- **`QuickReplyPicker`** — mounted in Story 05's composer. Fetches
  `GET /api/tickets/{ticket}/quick-replies`, inserts `body_rendered` into the composer value,
  shows the "Inserted from quick replies · still editable" affordance, and implements the artboard's
  keyboard model (`↑↓`, `Enter`, `Esc`), with a focus trap and focus return to the composer.
  It calls no send endpoint.
- **`TicketTasksPanel`** — the ticket-detail sidebar panel, its add-task form, and the four states.
  Due-state labels render from the resource's `due_state` plus a relative formatter.
- **Internal-note composer mode** — a mode toggle inside Story 05's composer that sets
  `visibility: 'internal'`, renders the `Not visible to customer` banner, and drives the `@mention`
  autocomplete off `GET /api/tickets/{ticket}/mentionable-users`. On send failure the note text is
  preserved and a Retry is offered (per the artboard).
- **`useMyOpenTasks`** — the exported hook Story 07's dashboard consumes.
- **RTL/dark** — the picker, tasks panel, and note composer have RTL and dark artboards; the admin
  library screen does not, and is derived from tokens. Both directions are verified by toggling
  `UiPreferencesContext`, not by a separate stylesheet.

---

## Edge Cases & Failure Modes

- **Archived template still referenced.** Archiving hides a template from the picker and from
  `GET /api/tickets/{ticket}/quick-replies`; messages already sent from it are untouched, because
  the message stores rendered text, not a foreign key to the template.
- **Unresolvable placeholder.** A ticket with no linked customer first name renders
  `{{customer.first_name}}` literally. The renderer has a dedicated test for this — "Hello ,"
  reaching a customer is the failure this rule exists to prevent.
- **Placeholder-looking text in a customer's own data.** A customer whose name literally contains
  `{{` must not trigger a second substitution pass. The renderer performs **one** pass over the
  template and never re-scans its own output.
- **Mention of an unauthorized user.** Rejected with 422 and a reason naming the user. The note is
  **not** persisted partially — mention resolution runs before the message insert, in one
  transaction. Mentioning must never become a content-leak channel.
- **Mention of a deactivated user (Story 08).** Excluded from `mentionable-users` and rejected on
  submit. Story 11's dispatcher independently drops delivery to disabled accounts, so this is
  defended twice.
- **Task with no due date.** Allowed. `due_at IS NULL` never enters the reminder query; `due_state`
  is `none`.
- **Reminder job runs twice / overlapping schedules.** `reminded_at` is the idempotency guard and
  is stamped in the same transaction as the dispatch. The command also takes Laravel's
  `withoutOverlapping` lock, matching Story 06's SLA command.
- **Task due while the ticket is being closed.** The close transaction cancels open tasks; a
  concurrent reminder either sees `status = open` (fires once, harmlessly, before the close
  commits) or sees `cancelled` (skips). Both are acceptable; a reminder for an already-closed
  ticket after the close commits is not, and the `status` filter prevents it.
- **Reassigning a task after a reminder fired.** `reminded_at` is cleared on assignee change so the
  new assignee is reminded once.
- **Internal note in an export path.** Every path that renders ticket history for a customer must
  go through the `publicOnly()` scope. This is the highest-consequence failure in the story and has
  its own explicit test (see Test Plan item 6).
- **Long template body.** `body` is `text`; the library table shows a single-line truncated preview
  matching the artboard, with the full body in the edit modal.
- **Stated uncertainty.** The exact composer API surface (whether the picker sets state through a
  prop callback or a ref) is **not** decided here — it depends on how Story 05 builds the composer.
  Decide it at regeneration time, after reading Story 05's implementation.
- **Stated uncertainty.** Whether Story 04 exposes a close **pre-check** endpoint or returns the
  open-task count from the close call itself is not decided here. Regeneration must read Story 04's
  shipped close transition and pick the one that exists rather than adding a second endpoint.

---

## Test Plan

Backend tests are Pest feature tests under `api/tests/Feature/`, matching the structure of the
existing `api/tests/Feature/ApiContractTest.php` and `api/tests/Feature/TicketScopeTest.php`.
Frontend tests are Vitest + Testing Library, matching `web/src/test/setup.ts`.

1. `api/tests/Feature/QuickReplyTest.php` — an agent gets 403 on create/edit/archive and 200 on
   list; a team lead and an administrator get 200 on all four; an archived template is absent from
   `GET /api/tickets/{ticket}/quick-replies` and present in the admin list under `status=archived`.
2. `api/tests/Unit/QuickReplyRendererTest.php` — each placeholder in the vocabulary resolves; an
   unresolvable placeholder is **echoed literally**; a customer name containing `{{` is not
   re-substituted; a template with no placeholders is returned unchanged.
3. `api/tests/Feature/TicketTaskTest.php` — create defaults the assignee to the creator; complete
   records `completed_by` and `completed_at`; a completed task is excluded from the reminder query;
   `GET /api/tasks?assignee=me&status=open` returns only the caller's open tasks.
4. `api/tests/Feature/TaskReminderTest.php` — running the command dispatches exactly one
   `task_due` notification per overdue task; running it twice dispatches none the second time
   (`reminded_at` guard); a task on a closed ticket dispatches nothing.
5. `api/tests/Feature/TicketCloseCancelsTasksTest.php` — closing a ticket with two open tasks
   transitions both to `cancelled` with `cancel_reason = 'ticket_closed'`, and the close response
   reports the count.
6. `api/tests/Feature/InternalNoteVisibilityTest.php` — **the critical test.** An internal note is
   absent from every customer-facing render path and from the public message index, and present for
   an authenticated agent. Asserted against the query result, not the rendered HTML.
7. `api/tests/Feature/MentionAuthorizationTest.php` — mentioning a user who fails
   `TicketPolicy::view` returns 422 naming the user, and **no message row is created**; a valid
   mention creates the `ticket_message_mentions` row, a ticket-history entry, and one `mention`
   notification; a deactivated user is absent from `mentionable-users`.
8. `web/src/features/agent-productivity/components/QuickReplyPicker.test.tsx` — selecting a
   template inserts its rendered body into the composer and **calls no send mutation**; the text
   remains editable afterwards; `Esc` closes and returns focus; the two empty states render for
   "no search match" and "library empty" respectively.
9. `web/src/features/agent-productivity/components/TicketTasksPanel.test.tsx` — the four async
   states render; `due_state` maps to the artboard's label text; the add-task form defaults the
   assignee to the current user.
10. `web/src/features/agent-productivity/pages/QuickRepliesPage.test.tsx` — the four async states;
    the archive confirmation names the specific template; the category and status filters write to
    URL search params, not component state.

---

## Verification Steps

1. **Backend migrates:** `cd api && php artisan migrate:fresh --seed` — no errors; the four
   schema changes apply on a populated database.
2. **Backend tests pass:** `cd api && ./vendor/bin/pest` — all new tests green, existing
   `ApiContractTest` and `TicketScopeTest` still green.
3. **Reminder command runs:** `cd api && php artisan tasks:dispatch-due-reminders -v` — reports the
   number of reminders dispatched; a second immediate run reports zero.
4. **Frontend tests pass:** `cd web && npx vitest run` — all new tests green. (There is **no `test`
   script** in `web/package.json`.)
5. **Lint clean:** `cd web && npm run lint` — no new oxlint findings.
6. **Build clean:** `cd web && npm run build` — `tsc -b` passes with no type errors.
7. **Regression, manual:** `cd web && npm run dev`; sign in as an Agent — `/quick-replies` is absent
   from the sidebar and returns the role-denied state if typed directly; open a ticket, insert a
   quick reply (text lands editable, nothing sends), add an internal note with an `@mention`, and
   confirm the bell (Story 11) shows the mention for the mentioned user. Repeat in Arabic/RTL and in
   dark theme via the header controls.

---

## Done Criteria

- [x] Selecting a quick reply in the Conversation Thread composer inserts its body, leaves it fully
      editable, and **never sends a message directly**.
- [x] An Administrator or Team Lead can create, edit, and archive quick replies; the ownership model
      is documented as **shared-library-only, no personal scope**, and enforced by `QuickReplyPolicy`.
- [x] Placeholders resolve against the current ticket and customer; an unresolvable placeholder
      renders visibly as-is — "Hello ," can never reach a customer.
- [x] An archived quick reply is not offered in the picker; messages already sent from it are
      unaffected.
- [ ] A task created on a ticket carries a due date and a specific assignee (defaulting to the
      creator) and appears on that person's Agent Dashboard via `GET /api/tasks?assignee=me`.
- [x] A task reaching its due time fires an in-app notification to its assignee through Story 11 on
      a **schedule**, not on ticket open.
- [x] Completing a task records who completed it and when, and stops further reminders.
- [x] Closing a ticket with open tasks **warns the agent and auto-cancels** those tasks; no reminder
      fires for a closed ticket.
- [ ] An internal note renders in the one chronological thread, visually distinct, and the
      public/internal split is enforced **server-side in the query**, not by CSS class.
- [x] An `@mention` in an internal note notifies the colleague via Story 11 and is recorded in
      ticket history.
- [x] An `@mention` of a user who cannot access the ticket is rejected with a clear reason and no
      message is persisted.
- [ ] An explicit test asserts internal notes are excluded from every customer-facing render path.
- [x] All four async states ship on the quick-reply library, the picker, and the tasks panel.
- [ ] Both themes and both directions verified through `UiPreferencesContext`.
- [x] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 11.**
