> **Fetched from jira:** [WIS-25](https://ibrahemelahmedy.atlassian.net/browse/WIS-25)  
> *Fetched 2026-09-08T22:14:24.104Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Realistic seed data — replace pagination filler with genuine tickets and threads  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Problem

DatabaseSeeder creates 4 hand-written tickets (2 with real threads) plus 60 factory filler tickets. The filler has:

	Latin lorem-ipsum subjects ("Inventore eveniet laudantium…")

	All created_at = now (every row reads "31 minutes ago")

	Zero messages

	Random Open/Closed/Pending status with no scenario behind it

A closed ticket with no conversation and no resolution is not believable in a demo or a review.

Goal

Every seeded ticket looks like a real support case: a plausible subject, a coherent thread, a status that follows from the thread, and a created date spread over recent weeks.

Scope

	A pool of ~40 realistic subjects in both English and Arabic, mapped to category.

	Each ticket gets a short thread (2–8 messages) alternating customer/agent, ending consistently with its status: Closed => a resolution message; Pending => waiting on customer; Open => last message from customer.

	created_at / message timestamps spread across the last ~6 weeks; SLA targets recomputed from the real created date (some breached, some at-risk, most healthy).

	Channel mix that visibly matches the /channels counts.

	CSAT seeded only on genuinely resolved tickets.

	Keep 1–2 deliberate empty-state rows, clearly the exception, not 60.

	The API and web suites stay green (some tests assert on seeded shapes — update them with the data).

Done criteria

	[ ] No lorem-ipsum subject anywhere in seeded data.

	[ ] Every Closed ticket has a resolving message; every Open ticket's last message is from the customer.

	[ ] Ticket and message timestamps span multiple weeks.

	[ ] /channels counts equal the actual per-channel ticket counts.

	[ ] php artisan test and npm run test both green.

	[ ] A short note in the README's "Run it" section on what the seed contains.

Process

Plan locally in squad-kit (.squad/) before implementing — new story + full-depth plan, then implement from the plan.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/seed-data-realism/WIS-25/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Realistic Seed Data — Genuine Tickets, Threads & Timelines
- **Feature slug (folder under `plans/`):** `seed-data-realism`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-25` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Realistic seed data — replace pagination filler with genuine tickets and threads
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Problem

DatabaseSeeder creates 4 hand-written tickets (2 with real threads) plus 60 factory filler tickets. The filler has:

	Latin lorem-ipsum subjects ("Inventore eveniet laudantium…")

	All created_at = now (every row reads "31 minutes ago")

	Zero messages

	Random Open/Closed/Pending status with no scenario behind it

A closed ticket with no conversation and no resolution is not believable in a demo or a review.

Goal

Every seeded ticket looks like a real support case: a plausible subject, a coherent thread, a status that follows from the thread, and a created date spread over recent weeks.

Scope

	A pool of ~40 realistic subjects in both English and Arabic, mapped to category.

	Each ticket gets a short thread (2–8 messages) alternating customer/agent, ending consistently with its status: Closed => a resolution message; Pending => waiting on customer; Open => last message from customer.

	created_at / message timestamps spread across the last ~6 weeks; SLA targets recomputed from the real created date (some breached, some at-risk, most healthy).

	Channel mix that visibly matches the /channels counts.

	CSAT seeded only on genuinely resolved tickets.

	Keep 1–2 deliberate empty-state rows, clearly the exception, not 60.

	The API and web suites stay green (some tests assert on seeded shapes — update them with the data).

Done criteria

	[ ] No lorem-ipsum subject anywhere in seeded data.

	[ ] Every Closed ticket has a resolving message; every Open ticket's last message is from the customer.

	[ ] Ticket and message timestamps span multiple weeks.

	[ ] /channels counts equal the actual per-channel ticket counts.

	[ ] php artisan test and npm run test both green.

	[ ] A short note in the README's "Run it" section on what the seed contains.

Process

Plan locally in squad-kit (.squad/) before implementing — new story + full-depth plan, then implement from the plan.
```

---

## Acceptance criteria

*(Copied verbatim from the Jira issue's "Done criteria" block. These six are the story's Done Criteria.)*

```
[ ] No lorem-ipsum subject anywhere in seeded data.
[ ] Every Closed ticket has a resolving message; every Open ticket's last message is from the customer.
[ ] Ticket and message timestamps span multiple weeks.
[ ] /channels counts equal the actual per-channel ticket counts.
[ ] php artisan test and npm run test both green.
[ ] A short note in the README's "Run it" section on what the seed contains.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| — | — |

None. Every fact this story needs is already in the repository; the paths are listed under
**Technical hints** below.

---

## Dependencies

- **Blocked by / related ids:** none. WIS-25 is first in the WIS-22..27 pipeline precisely because
  it has no external dependency — no API key, no third-party account, no webhook.
- **Depends on code areas or other stories:**
  - **Story 04 — ticket-management (WIS-2).** Owns `tickets`, `App\Enums\TicketStatus`,
    `App\Enums\Priority`, `App\Enums\Channel`, `Ticket::CATEGORIES`, and the `booted()` observer
    that writes a `ticket_events` row on every `created`/`updated`. Seeding through
    `Ticket::create()` fires that observer, so the seeder already writes history rows — the new
    seeder must keep doing so and must not disable model events.
  - **Story 05 — conversation-thread (WIS-3).** Owns `ticket_messages`, `TicketMessage::AUTHOR_*`
    and `MessageVisibility`. Every seeded thread is written through this table.
  - **Story 06 — sla-rules-automation (WIS-6).** `App\Services\SlaClock::applyTo()` anchors every
    target on `$ticket->created_at`. Backdating a ticket therefore *requires* re-running
    `applyTo()` after the date is set — which is exactly what "SLA targets recomputed from the real
    created date" means, and the mechanism already exists.
  - **Story 13 — csat-collection (WIS-14).** Owns `csat_surveys`. The current seeder attaches
    surveys to the first nine tickets of two agents regardless of status, which is the bug the
    "CSAT only on genuinely resolved tickets" bullet names.
  - **Story 14 — channels-overview (WIS-15).** `ChannelOverviewController` groups tickets by
    `channel` inside a `created_at` window (default period) and scopes by `Ticket::visibleTo()`.
    Any date-spreading that pushes tickets outside the default window changes the `/channels`
    numbers, so the spread and the window interact.
  - **Story 09 — knowledge-base (WIS-5).** `KnowledgeBaseSeeder` is the in-repo precedent for
    realistic, design-matched, partly Arabic seed content, and is called from `DatabaseSeeder`.

## Extra notes (optional)

- The current filler is three `Ticket::factory()` batches of 20 (assigned to agent1, agent2,
  unassigned) at `api/database/seeders/DatabaseSeeder.php:279–281`, plus four hand-written tickets
  at `:232–275`. `TicketFactory::definition()` supplies `fake()->sentence(6)` and
  `fake()->randomElement(TicketStatus::cases())`.
- The four hand-written tickets never set `resolved_at` or `closed_at`, so the seeded Closed CSV
  ticket has a Closed status and a null finish timestamp — visible in the UI as a closed ticket
  that was never closed.
- `seedThread()` at `:351–377` writes `fake()->paragraph()` bodies — Latin filler inside the two
  threads that do exist.
- **No PHP test in `api/tests` runs the seeder.** A repo-wide grep for `DatabaseSeeder`,
  `->seed(`, `Seeder::class` in `api/tests` returns nothing; every feature test builds its own rows
  from factories. The web suite's references to `agent@wisal.test` are hard-coded string fixtures in
  vitest files, not assertions against seeded rows. The Jira line "some tests assert on seeded
  shapes" was written defensively; the planner must verify and record what is actually true.
- `TicketFactory` is used by **48 test files**. Any change to its `definition()` must keep every
  existing state valid — the factory's randomness is what several tests rely on *not* being fixed.
- `api/phpunit.xml:53–58` points at local PostgreSQL (`wisal_testing` / `wisal_test`); `pdo_sqlite`
  is unavailable on this machine. All 419+ backend tests are green on that connection today.

## Technical hints (optional)

Repos/roots: `.` (`api/` Laravel 12 + `web/` React 19). Files this story touches or reads:

- `api/database/seeders/DatabaseSeeder.php` — the file being rewritten.
- `api/database/factories/TicketFactory.php` — `definition()` at `:21–34`.
- `api/app/Models/Ticket.php` — `CATEGORIES` `:19`, `$fillable` `:21–29`, `finishedAt()` `:89–92`,
  `booted()` `:202–230`, `recordEvent()` `:265–276`.
- `api/app/Models/TicketMessage.php` — `AUTHOR_*` `:20–24`, `$fillable` `:26`, `publicOnly()`.
- `api/app/Services/SlaClock.php` — `applyTo()` `:52–95` (anchors on `created_at`), `riskFor()`.
- `api/app/Http/Controllers/ChannelOverviewController.php` — the `/channels` aggregate.
- `api/app/Enums/Channel.php` (5 cases), `TicketStatus.php` (4 cases), `Priority.php`.
- `api/app/Models/CsatSurvey.php` — `$fillable` `:24–27`, the `state` accessor.
- `api/database/seeders/KnowledgeBaseSeeder.php` — the style precedent for realistic seed content.
- `README.md` §1 "Run it in 60 seconds" (`:88–128`) — where the seed-contents note goes.

## Out of scope

- **No schema change.** No migration, no new column, no new table. This is a data story.
- **No change to `TicketFactory`'s randomness contract** beyond replacing the lorem subject/body
  source — 48 test files depend on the factory staying a general-purpose random ticket generator.
- **No change to `/channels`, `SlaClock`, `TicketResource` or any controller.** If the seeded data
  and an endpoint disagree, the data is wrong, not the endpoint.
- **No Arabic UI work.** The Arabic subjects and bodies are *content*, seeded as data. Nothing in
  `web/src/i18n` or `api/lang` changes.
- **No new demo screenshots.** `docs/screenshots/` is left as-is; refreshing it is a follow-up.
- **No seeding of `notifications`, `ticket_tasks`, `quick_replies` or `ai_assist_artifacts`**
  beyond whatever the existing seeders already do.
