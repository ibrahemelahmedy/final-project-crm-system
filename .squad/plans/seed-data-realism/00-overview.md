# seed-data-realism — plan overview

Entry point for the **seed-data-realism** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 21 | [21-story-seed-data-realism.md](21-story-seed-data-realism.md) | Realistic Seed Data — Genuine Tickets, Threads & Timelines | WIS-25 | Stories 04, 05, 06, 09, 13, 14 |

## Dependency notes

**This is a data story, not a feature story.** It adds no migration, no endpoint, no model, no policy
and no frontend module. It rewrites what `php artisan migrate:fresh --seed` produces, and nothing
else. Planned at **full** depth: every path, line range and command was verified against real code
at plan time.

- **Depends on** [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md)
  for `tickets`, the four enums, `Ticket::CATEGORIES` and the `booted()` observer that writes
  `ticket_events`. Seeding through `Ticket::create()` fires that observer; this story **repairs the
  event's timestamp** after backdating rather than suppressing the event.
- **Depends on** [`../conversation-thread/05-story-conversation-thread.md`](../conversation-thread/05-story-conversation-thread.md)
  for `ticket_messages` and `MessageVisibility`. `TicketMessageController::index` cursor-paginates
  at **30**, which is the only reason one seeded thread is 36 messages long.
- **Depends on** [`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md).
  `SlaClock::applyTo()` anchors every target on `created_at`, so "SLA recomputed from the real
  created date" is *ordering*, not new code: backdate first, `applyTo()` second.
- **Depends on** [`../csat-collection/13-story-csat-collection.md`](../csat-collection/13-story-csat-collection.md).
  `TicketResolutionObserver` fires only on an **update** to `Resolved`; because every seeded ticket
  is created with its final status, the observer stays inert and CSAT rows are written deliberately.
- **Depends on** [`../channels-overview/14-story-channels-overview.md`](../channels-overview/14-story-channels-overview.md).
  Its default window is **30d** while the seed spans 42 days, so the `/channels` Done Criterion is
  discharged at `?period=90d`. **The endpoint is not changed.**
- **Follows the shape of** `api/database/seeders/KnowledgeBaseSeeder.php` (Story 09): a separate
  seeder class called from `DatabaseSeeder`, with a docblock naming what it deliberately seeds.

**Contracts this story establishes**, which a later story consumes rather than redefines:

- **`api/database/seeders/data/*.php` is where authored seed content lives** — three plain PHP files
  returning arrays (`ticket-scenarios.php`, `ticket-message-templates.php`, `ticket-schedule.php`),
  loaded with `require`, never autoloaded as classes. A later story adding seeded content follows
  this shape instead of growing `DatabaseSeeder::run()`.
- **`DatabaseSeeder` seeds no tickets.** From this story on, it seeds SLA rules, org structure,
  users and customers, then calls `KnowledgeBaseSeeder` and `TicketScenarioSeeder`. `Ticket::factory()`
  is for **tests only**.
- **Age follows status.** Running tickets (Open/Pending) are hours old; finished tickets
  (Resolved/Closed) are days old. Any future story that adds seeded tickets keeps this rule, or the
  queue fills with impossible SLA breaches.
- **`api/tests/Feature/Seeding/SeededDataRealismTest.php`** is the one test in the repo that runs
  `DatabaseSeeder`. Keep it to one file — it is the slowest test in the suite.

## Deliberate deferrals

Recorded here so a later story picks them up instead of this one growing:

- **`docs/screenshots/` is not regenerated.** Every screenshot in `README.md` shows the old filler
  subjects. Refreshing them is a separate pass, and it wants a human eye on each frame.
- **Case-insensitive subject search.** `Ticket::scopeFilter` uses a bare `LIKE`, which is
  case-sensitive on PostgreSQL. The Arabic subjects seeded here are unaffected (Arabic has no case),
  but English subject search stays case-sensitive. Fixing it is a ticket-management change, not a
  seed change, and it must stay valid on SQLite.
- **Re-seeding the deployed Supabase database.** This change alters what a *fresh* seed produces; a
  live demo database keeps its old rows until someone re-runs the seeder there. No data migration is
  added.
- **Seeding `notifications`, `ticket_tasks` and `quick_replies` against the new threads.** Those
  surfaces still show whatever their own stories seed. A follow-up can hang them off the real
  threads this story creates.
