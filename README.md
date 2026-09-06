# Wisal (وِصال) — Customer Support CRM

A ticket-centric customer support platform: a Laravel REST API and a React SPA, built as a
monorepo. Agents work a prioritised queue, answer across channels from one thread, and are held
to SLA targets that a scheduled engine evaluates on its own. Team Leads see workload and
escalations; Administrators own users, roles, SLA policy, integrations and the organisation's
branches, departments and branding. Everything ships in Arabic and English, right-to-left and
left-to-right, light and dark.

This README is the project's documentation. It is written to be read start to finish: what the
system does, how it is built, why it is built that way, how it was planned and verified, and
where it is honestly incomplete. Every claim below points at the file that proves it.

---

## Contents

| Section | What you get |
|---|---|
| [1. Run it in 60 seconds](#1-run-it-in-60-seconds) | Clone → migrate → seed → login |
| [2. What was asked for, and what shipped](#2-what-was-asked-for-and-what-shipped) | The 12 requirement categories, each with a status and a reason |
| [3. Architecture](#3-architecture) | Layers, request lifecycle, the deliberate structural decisions |
| [4. Data model](#4-data-model) | ERD, the core tables, the invariants they encode |
| [5. API surface](#5-api-surface) | Every endpoint, grouped, with its guard |
| [6. Frontend](#6-frontend) | Feature folders, state, forms, i18n and RTL |
| [7. Security and access control](#7-security-and-access-control) | Roles, policies, rate limits, audit trail |
| [8. Testing](#8-testing) | What is covered, what the edge-case tests actually assert |
| [9. How this was built](#9-how-this-was-built--spec-driven-ai-assisted) | The spec-driven loop, and how AI output was verified |
| [10. Known gaps](#10-known-gaps) | The unflattering list |
| [11. Deployment](#11-deployment) | Vercel, Supabase, the one cron line |
| [12. Repository map](#12-repository-map) | Where everything lives |
| [ملخص بالعربية](#ملخص-بالعربية) | Arabic summary |

---

## 1. Run it in 60 seconds

Requirements: PHP 8.3+, Node 20+, and PostgreSQL (or any engine Laravel supports — see
[the dual-engine note](#the-dual-engine-constraint)).

```bash
cd api && composer install && cp .env.example .env && php artisan key:generate
```

```bash
cd api && php artisan migrate --seed
```

```bash
cd api && php artisan serve --port=8000
```

```bash
cd web && npm install && npm run dev
```

The seeder ([api/database/seeders/DatabaseSeeder.php](api/database/seeders/DatabaseSeeder.php))
creates one account per role, all with the password `Password123!`:

| Email | Role | Use it to see |
|---|---|---|
| `agent@wisal.test` | Agent | The queue, the thread, quick replies, tasks |
| `lead@wisal.test` | Team Lead | Workload, escalations, reports |
| `admin@wisal.test` | Administrator | Users, SLA rules, integrations, organisation settings |
| `disabled@wisal.test` | Agent (deactivated) | The `active` middleware refusing a valid token |

The SLA engine is a scheduled command, not a queued job — nothing drains the `jobs` table in
this repository. Run it directly, or run the scheduler:

```bash
cd api && php artisan sla:evaluate
```

`--dry-run` reports without writing. `--backfill` stamps SLA targets on tickets created before
the SLA story landed, and is idempotent.

---

## 2. What was asked for, and what shipped

The client's requirement capture is
[docs/requirements/client-requirements-raw.md](docs/requirements/client-requirements-raw.md) —
twelve categories. Nothing below is aspirational; a "partial" row says what is missing, and an
"out of scope" row says why the line was drawn there.

| # | Category | Status | Where it lives | Story |
|---|---|---|---|---|
| 1 | Customer Management | ✅ Done | `web/src/features/customers`, `api/app/Http/Controllers` + `CustomerPolicy` | WIS-4 |
| 2 | Ticket Management | ✅ Done | `web/src/features/tickets`, `api/app/Models/Ticket.php` | WIS-2 |
| 3 | Communication Channels | ⚠️ Partial | Every message carries a channel (`api/app/Enums/Channel.php`); `web/src/features/channels` is a read-only overview that states plainly that live ingestion is not in this release | WIS-15 |
| 4 | Agent Dashboard | ✅ Done | `web/src/features/agent-dashboard`, `api/app/Services/DashboardMetrics.php` | WIS-9 |
| 5 | SLA & Automation | ✅ Done | `api/app/Services/SlaClock.php`, `api/app/Console/Commands/EvaluateSlaCommand.php`, `TicketAssigner.php` | WIS-6 |
| 6 | Knowledge Base | ✅ Done | `web/src/features/knowledge-base`, `api/app/Services/Kb`, versioned articles | WIS-5 |
| 7 | AI Features | ⚠️ Partial | Ticket summary and suggested reply, `api/app/Services/Ai` + `web/src/features/ai-assist`. Auto-classification and a chatbot are not built | WIS-18 |
| 8 | Customer Portal | ✅ Done | `web/src/features/portal`, OTP access codes (`PortalAccess.php`), separate auth from staff | WIS-16 |
| 9 | Reports & Management | ✅ Done | `web/src/features/reports`, `api/app/Services/ReportAggregator.php` | WIS-7 |
| 10 | Security & Administration | ✅ Done | Roles, policies, append-only audit log, `web/src/features/users-roles-admin` | WIS-8 |
| 11 | Integrations | ⚠️ Partial by design | `web/src/features/integrations` — the admin surface to connect, configure, test and monitor. No live provider wiring; that is per-provider engineering | WIS-19 |
| 12 | Platform | ⚠️ Partial | Arabic/English + RTL shipped; branches, departments and custom branding shipped (`web/src/features/organization`). String extraction is incomplete — see [Known gaps](#10-known-gaps) | WIS-11, WIS-17, WIS-20 |

Twenty stories were specified, planned and implemented (WIS-1 … WIS-20). Their specifications
are in [.squad/stories/](.squad/stories) and their implementation plans in
[.squad/plans/](.squad/plans), indexed by [.squad/plans/00-index.md](.squad/plans/00-index.md).

---

## 3. Architecture

A monorepo with two deployables and no shared runtime code — the contract between them is HTTP
and JSON only.

```mermaid
flowchart TB
    subgraph Client["web/ — React 19 SPA (Vite, TypeScript)"]
        UI["16 feature folders<br/>src/features/*"]
        RQ["TanStack Query<br/>server-state cache"]
        AX["axios client<br/>src/lib/api.ts"]
        UI --> RQ --> AX
    end

    subgraph API["api/ — Laravel REST API"]
        MW["Middleware<br/>SecurityHeaders → SetLocale → auth:sanctum → active/administrator"]
        FR["Form Requests<br/>validation"]
        CT["Controllers<br/>thin: authorize, delegate, respond"]
        PO["Policies<br/>12 resource policies"]
        SV["Services<br/>all business logic"]
        MO["Models + Observers"]
        RS["API Resources<br/>response shaping"]
        MW --> FR --> CT
        CT --> PO
        CT --> SV --> MO
        CT --> RS
    end

    subgraph Jobs["Scheduled work"]
        SLA["sla:evaluate"]
        REM["task reminders"]
    end

    DB[("PostgreSQL")]

    AX -->|"/api/*"| MW
    MO --> DB
    SLA --> DB
    REM --> DB
```

**Controllers stay thin.** They authorize, delegate and shape a response. Every rule that a
second caller could need lives in a service — 29 of them under
[api/app/Services/](api/app/Services). The clearest example is
[SlaClock.php](api/app/Services/SlaClock.php): every screen, widget, report and command reads
SLA risk through that one class, so "a rule edit applies going forward only" is a mechanism
rather than a convention, and a 25-row queue page costs zero extra queries to classify.

**Validation happens before a controller runs**, in Form Requests under
[api/app/Http/Requests/](api/app/Http/Requests). Authorization happens in
[policies](api/app/Policies) — twelve of them, one per resource — not in `if` statements
scattered through controllers.

**Why the SLA engine is a scheduled command, not a queued job.** A queue needs a worker process
that stays alive; the deployment target is serverless. A breach is also a function of elapsed
time, not of an event — nothing fires when a ticket *becomes* late. A periodic sweep over the
rows whose targets have passed is the honest model, and it is idempotent, so a missed or
duplicated run cannot corrupt state. See
[EvaluateSlaCommand.php](api/app/Console/Commands/EvaluateSlaCommand.php).

**Cross-cutting middleware** is registered in
[api/bootstrap/app.php](api/bootstrap/app.php): `SecurityHeaders` on every response, `SetLocale`
resolving `Accept-Language` so server-sent labels come back in the caller's language, then
`auth:sanctum` plus an `active` gate, plus an `administrator` gate on the admin route groups.

### The dual-engine constraint

Runtime is PostgreSQL (Supabase). Local test runs have moved between SQLite and a local
PostgreSQL instance over the project's life, for a reason documented in
[docs/debugging/002-pdo-sqlite-blocked.md](docs/debugging/002-pdo-sqlite-blocked.md): Windows
Application Control blocked the PHP PostgreSQL driver, then later the SQLite one. The lasting
consequence is a rule the codebase still follows: **every migration and every raw expression must
be valid on both engines.** No PostgreSQL-only column types, no `ILIKE` in shared queries, no
engine-specific JSON operators outside a guarded branch.

---

## 4. Data model

39 migrations under [api/database/migrations/](api/database/migrations), 23 Eloquent models.
The core:

```mermaid
erDiagram
    USERS ||--o{ TICKETS : "assigned"
    USERS }o--|| BRANCHES : "belongs to"
    USERS }o--|| DEPARTMENTS : "belongs to"
    CUSTOMERS ||--o{ TICKETS : "raises"
    CUSTOMERS ||--o{ CUSTOMER_NOTES : has
    CUSTOMERS ||--o{ CUSTOMER_ATTACHMENTS : has
    TICKETS ||--o{ TICKET_MESSAGES : contains
    TICKETS ||--o{ TICKET_EVENTS : "audit history"
    TICKETS ||--o{ TICKET_TASKS : has
    TICKETS ||--o| CSAT_SURVEYS : "surveyed by"
    TICKETS ||--o{ AI_ASSIST_ARTIFACTS : "summarised by"
    TICKET_MESSAGES ||--o{ TICKET_MESSAGE_MENTIONS : mentions
    SLA_RULES ||--o{ TICKETS : "targets stamped from"
    KB_CATEGORIES ||--o{ KB_ARTICLES : groups
    KB_ARTICLES ||--o{ KB_ARTICLE_VERSIONS : "versioned by"
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDIT_LOGS : "acts in"
    CUSTOMERS ||--o{ PORTAL_ACCESS_CODES : "authenticates via"
    CUSTOMERS ||--o{ PORTAL_SESSIONS : holds
```

Four invariants worth knowing, each enforced in the schema rather than in application code:

- **`tickets.customer_id` is required.** A ticket with no customer is not a support ticket.
  Enforced by [`require_tickets_customer_id`](api/database/migrations/2026_08_27_120100_require_tickets_customer_id.php).
- **`audit_logs` is append-only** — no update, no delete path. See
  [`make_audit_logs_append_only`](api/database/migrations/2026_08_28_090200_make_audit_logs_append_only.php).
- **SLA targets are stamped onto the ticket row**, not read back through a rule at display time
  ([`add_sla_columns_to_tickets_table`](api/database/migrations/2026_08_27_130100_add_sla_columns_to_tickets_table.php)).
  That is what makes an SLA rule edit apply to future tickets only.
- **A message carries a visibility**, so an internal note can never leak into a customer-visible
  thread ([`add_visibility_to_ticket_messages_table`](api/database/migrations/2026_08_28_140000_add_visibility_to_ticket_messages_table.php),
  enum in [MessageVisibility.php](api/app/Enums/MessageVisibility.php)).

Domain vocabulary is typed as PHP enums, never as loose strings —
[api/app/Enums/](api/app/Enums), fourteen of them:

| Enum | Values |
|---|---|
| `UserRole` | `agent`, `team_lead`, `administrator` |
| `TicketStatus` | `open`, `pending`, `resolved`, `closed` |
| `Priority` | `low`, `normal`, `high`, `urgent` |
| `Channel` | `email`, `whatsapp`, `chat`, `sms`, `web_form` |
| `MessageVisibility` | public / internal note |
| plus | `ArticleStatus`, `AssistKind`, `CsatSurveyState`, `CustomerTier`, `IntegrationStatus`, `IntegrationType`, `NotificationType`, `QuickReplyStatus`, `TaskStatus` |

---

## 5. API surface

All routes are declared in [api/routes/api.php](api/routes/api.php) (334 lines, grouped by
guard rather than by controller so the protection on any endpoint is readable at a glance).

**Public** — no token:

| Method | Path | Guard |
|---|---|---|
| `POST` | `/api/login` | `throttle:login` — 5/min per email+IP, 20/min per IP |
| `GET`/`POST` | `/api/csat/{uuid}` | `signed` + `throttle:csat` |
| `POST` | `/api/portal/access/request` · `/verify` | separate portal limiters |
| `GET` | `/api/portal/faq` · `/faq/{slug}` | `throttle:portal-access` |

**Staff** — `auth:sanctum` + `active`:

| Area | Endpoints |
|---|---|
| Session | `GET /user`, `PATCH /user/preferences`, `POST /logout` |
| Tickets | `GET /tickets`, `/tickets/meta`, `POST /tickets`, `POST /tickets/bulk`, `GET`/`PATCH /tickets/{ticket}`, `GET /tickets/{ticket}/events` |
| Thread | `GET`/`POST /tickets/{ticket}/messages`, `GET /tickets/{ticket}/mentionable-users` |
| AI assist | `GET /tickets/{ticket}/ai-assist`, `POST …/summary`, `POST …/reply`, `DELETE …/reply` — `throttle:ai-assist` |
| Customers | `apiResource customers`, `/customers/facets`, `/customers/bulk`, `/{customer}/tickets`, `/notes`, `/attachments` |
| Productivity | `/quick-replies` (+ `/archive`), `/tickets/{ticket}/tasks`, `/tasks`, `/tasks/{task}/complete` |
| Dashboards | `/agent/summary` · `/queue` · `/sla-risk`, `/team/summary` · `/workload` · `/escalations`, `/admin/summary` |
| Reports | `/reports/summary`, `/channels/overview` |
| Knowledge base | `/kb/articles` (+ publish / unpublish / archive / bulk), `/kb/categories`, `/kb/search`, `/kb/preview` |
| Notifications | `/notifications`, `/unread-count`, `/read-all`, `/{notification}/read` |
| Branding | `/organization/branding` |

**Administrator only** — the routes above plus the `administrator` middleware:

| Area | Endpoints |
|---|---|
| Users | `GET`/`POST /users`, `GET`/`PATCH /users/{user}`, `/deactivate`, `/activate`, `/users/facets` |
| SLA policy | `GET`/`POST /sla-rules`, `PATCH`/`DELETE /sla-rules/{rule}` |
| Audit | `GET /audit-logs`, `/audit-logs/facets` |
| Settings | `GET`/`PATCH /settings` |
| Integrations | `GET /integrations`, `PUT`/`DELETE /integrations/{type}`, `POST /integrations/{type}/test` |
| Organisation | `/branches`, `/departments`, `/branding` (+ logo upload / delete) |

Response shaping is done by API Resources
([api/app/Http/Resources/](api/app/Http/Resources)), never by returning a model directly — that
is what keeps a masked integration secret masked, and an internal note out of a portal payload.
The response contract is locked by
[api/tests/Feature/ApiContractTest.php](api/tests/Feature/ApiContractTest.php).

---

## 6. Frontend

React 19 + TypeScript on Vite. Dependencies are deliberately few: TanStack Query for server
state, React Hook Form + Zod for forms, react-i18next for language, React Router for routing,
Recharts for the report charts, axios for transport.

```
web/src/
├── app/           the shell every screen renders inside — layout, navigation, providers
├── components/    shared primitives used by more than one feature
├── features/      16 folders, one per product area, each self-contained
├── i18n/          config + ar/ and en/ namespace JSON
├── lib/           api.ts (axios instance) and queryClient.ts
└── test/          setup and shared test utilities
```

**No global client-state store.** Server data lives in TanStack Query, which owns caching,
invalidation and refetching. The only React contexts are the ones holding genuinely global UI
state — `UiPreferencesContext` (theme, language) and `BrandingProvider` (the organisation's
colours and logo). Anything else is local component state, on purpose.

**Navigation is role-aware at the source.**
[web/src/app/navigation/navItems.tsx](web/src/app/navigation/navItems.tsx) declares the roles
allowed to see each item, so an Agent is never shown a link they would be refused at. The
server enforces the same rule independently — the nav config is UX, not security.

**Every screen ships three states.** Loading, empty and error are required, not optional, and
are reviewed as part of the design brief
([docs/design/brief.md](docs/design/brief.md)). The design system — tokens, priority and status
colours, typography, the full RTL mirroring rules, light and dark — is that document, with every
screen exported under [docs/design/references/](docs/design/references) in four variants
(light/dark × LTR/RTL).

**Arabic is a first-class direction, not a stylesheet flip.** Layout mirrors, icons that imply
direction mirror, numerals and dates localise, and the language switch is instant. A lint rule
enforces it: `npm run lint` runs
[web/scripts/check-no-literals.mjs](web/scripts/check-no-literals.mjs), which fails the build on
a hard-coded user-facing string inside any enforced root. The enforced roots and every
deliberate exception (with its reason) are in
[web/scripts/i18n-allowlist.json](web/scripts/i18n-allowlist.json). That list is also an honest
record of what is *not* yet enforced — see [Known gaps](#10-known-gaps).

---

## 7. Security and access control

**Authentication.** Laravel Sanctum tokens for staff. The Customer Portal deliberately does
*not* reuse it: external customers authenticate with a one-time access code and a separate
session table, resolved by its own [`PortalAuth`](api/app/Http/Middleware/PortalAuth.php)
middleware, never `auth:sanctum`. The reasoning — including why an OTP rather than a magic link
— is [ADR-005](docs/decisions/ADR-005-customer-portal-access.md). Staff auth is
[ADR-004](docs/decisions/ADR-004-authentication.md).

**Authorization** is three layers, and each is independent:

1. Route-group middleware — `active` on everything authenticated, `administrator` on the admin
   groups.
2. Policies — twelve, one per resource, in [api/app/Policies/](api/app/Policies).
3. Query scoping — an Agent's list endpoints are scoped, not filtered client-side. Asserted by
   [TicketScopeTest.php](api/tests/Feature/TicketScopeTest.php) and
   [NotificationScopeTest.php](api/tests/Feature/NotificationScopeTest.php).

**Roles.**

| Capability | Agent | Team Lead | Administrator |
|---|:--:|:--:|:--:|
| Work the ticket queue, reply, take notes | ✅ | ✅ | ✅ |
| See other agents' workload and escalations | — | ✅ | ✅ |
| Reports | — | ✅ | ✅ |
| Manage quick replies | — | ✅ | ✅ |
| Users, roles, activation | — | — | ✅ |
| SLA rules, integrations, organisation settings, audit log | — | — | ✅ |

**Rate limiting is per-surface, never shared** — declared in
[api/bootstrap/app.php](api/bootstrap/app.php) with the reasoning inline. Six separate limiters:
`login`, `csat`, `portal-access`, `portal-verify`, `portal`, `ai-assist`. They are separate on
purpose: a flood of public CSAT traffic must not lock out agents, and an agent looping the AI
regenerate button behind an office NAT must not lock out the floor — so `ai-assist` is keyed on
the user id, at 6/minute and 200/day.

**Other measures.** `SecurityHeaders` on every response. Integration secrets encrypted at rest
and masked in every API response, including on the configure view of an already-connected
integration. An append-only audit log with its own viewer. A tampered CSAT signature renders the
same calm "expired" state as an unknown one, so the link space cannot be enumerated — the
handler is in [bootstrap/app.php](api/bootstrap/app.php) and the behaviour is under test.

---

## 8. Testing

Two suites, both green on the commit this README landed on:

| Suite | Files | Tests | Assertions | Run |
|---|---|---|---|---|
| API (Pest) | 109 | **500 passed** | 2,345 | `cd api && vendor/bin/pest` |
| Web (Vitest) | 83 | **546 passed** | — | `cd web && npm run test` |

`npm run lint` (oxlint + the i18n literal check) and `npm run build` are clean.

```bash
cd api && vendor/bin/pest
```

```bash
cd web && npm run test
```

```bash
cd web && npm run lint && npm run build
```

Coverage is not spread evenly on purpose — it is concentrated on the places where a wrong answer
is expensive, and most of those tests exist because an edge case was reasoned about before the
code was written:

| What is asserted | Test |
|---|---|
| The response envelope of every endpoint stays stable | `api/tests/Feature/ApiContractTest.php` |
| An agent cannot see another agent's tickets, at the query level | `TicketScopeTest.php` |
| An internal note never reaches a customer-visible payload | `InternalNoteVisibilityTest.php` |
| You cannot mention a user you are not allowed to see | `MentionAuthorizationTest.php` |
| The same SLA event never fires two notifications | `NotificationIdempotencyTest.php` |
| Closing a ticket cancels its open tasks | `TicketCloseCancelsTasksTest.php` |
| A report over a range with no data returns a well-formed empty result, not a crash | `ReportEmptyDataTest.php` |
| A duplicate customer is detected rather than silently created twice | `CustomerDuplicateTest.php` |
| Portal code exhaustion returns 410, and is not confused with a 429 | `api/tests/Feature/Portal/` |
| Arabic locale resolution on server-sent labels | `api/tests/Feature/I18n/` |

On the frontend, tests sit next to the component they cover (`AppLayout.test.tsx`,
`navItems.test.ts`, `BrandingProvider.test.tsx`, …), which is why the count is high relative to
the size of the app: the shell, navigation gating, RTL layout and provider behaviour are each
pinned independently.

---

## 9. How this was built — spec-driven, AI-assisted

This project was built with AI assistance under a fixed process, and the process left artefacts
behind on purpose. They are in the repository, not in a chat log.

```mermaid
flowchart LR
    A["Jira issue<br/>WIS-n"] --> B["intake.md<br/>scope, constraints,<br/>out-of-scope, dependencies"]
    B --> C["/squad-plan<br/>→ NN-story-*.md"]
    C --> D["scoped implementation<br/>session — plan file only"]
    D --> E["tests + review"]
    E --> F["Done Criteria ticked<br/>index flips to implemented"]
    F -.->|"a defect that<br/>survived review"| G["docs/debugging/NNN"]
    G -.->|"rule adopted"| B
```

**Specification before implementation.** Each story starts as a Jira issue and becomes an
`intake.md` — scope, explicit constraints, out-of-scope, dependencies, design reference. Twenty
of them: [.squad/stories/](.squad/stories). The out-of-scope section is the load-bearing part;
it is why "Customer Portal login" appears as a deferral in five earlier stories before becoming
WIS-16, rather than being quietly bolted onto staff auth.

**Planning before code.** The intake is turned into a plan under
[.squad/plans/](.squad/plans) — owned tables, enums and endpoints, cross-story contracts, edge
cases, a test plan and done criteria. Plans are written at one of two depths, and the index
records which: `full` (verified file paths and line ranges, implement straight from it) or
`contract` (scope and contracts final, file paths deliberately absent because the code they
build on does not exist yet — inventing line numbers would be a lie). See
[.squad/plans/00-index.md](.squad/plans/00-index.md).

**Implementation in a scoped session.** A fresh session gets the plan file and nothing else, so
the model cannot drift into unrelated code.

**Verification, and what it caught.** The interesting artefact is
[docs/debugging/](docs/debugging) — ten write-ups of real defects, each one *what happened → why
→ how it was fixed*, and several of them are cases where a plausible-looking generated solution
was wrong and was caught by testing rather than by reading:

- [003](docs/debugging/003-vercel-bootstrap-cache.md), [004](docs/debugging/004-vercel-api-origin.md),
  [005](docs/debugging/005-vercel-script-name.md) — three separate serverless deployment failures,
  each one invisible locally.
- [006](docs/debugging/006-claude-design-defects.md) — a recurring defect class in generated
  markup: a CSS class referenced in the HTML with no rule defined for it (focus-visible and
  skeleton styles). The response was a rule: grep for it before trusting any new export.
- [008](docs/debugging/008-sla-seed-mismatch.md) — SLA dashboards rendering dashes instead of
  numbers because seeded data and engine expectations had drifted apart.
- [002](docs/debugging/002-pdo-sqlite-blocked.md) — the environment problem that produced the
  dual-engine rule the whole schema now follows.

**Decisions are recorded, not remembered.** [docs/decisions/](docs/decisions) holds the ADRs.
Where a decision departs from an earlier one, the newer ADR says so and explains why — ADR-005
deliberately breaks with ADR-004's model for a different audience.

---

## 10. Known gaps

Stated plainly, because a reviewer will find them anyway and because pretending otherwise is
worse than the gap.

- **The i18n retrofit is incomplete.** Both locale catalogues exist and every server-sent label
  is localised, but the lint rule that forbids hard-coded strings is only enforced on ten roots.
  Nine feature folders — `customers`, `knowledge-base`, `notifications`, `reports`,
  `users-roles-admin`, `agent-dashboard`, `agent-productivity`, `channels`, `csat` — still hold
  English literals and will render English inside the Arabic UI. Tracked as WIS-17, current
  state in [web/scripts/i18n-allowlist.json](web/scripts/i18n-allowlist.json) and
  [docs/debugging/009-i18n-retrofit-gap.md](docs/debugging/009-i18n-retrofit-gap.md).
- **Some plans are still at `contract` depth.** The index marks them. They are implemented, but
  the plan file was never regenerated at full depth afterwards.
- **Integrations are a configuration surface only.** Connect, configure, test and monitor —
  no live ERP field mapping, no real WhatsApp/SMS/Email send-and-receive. This is a stated
  scope boundary (WIS-19), not an oversight.
- **AI features are partial.** Summary and suggested reply are built; auto-classification and a
  customer-facing chatbot are not.
- **Channels are read-only.** Every message is tagged with its channel and the overview screen
  reports honestly that live ingestion is not in this release.
- **Test execution is environment-sensitive.** Windows Application Control has blocked PHP
  database drivers on this machine more than once; `api/phpunit.xml` currently targets a local
  PostgreSQL database. Running the API suite with `--parallel` needs a database user with
  `CREATEDB`.

---

## 11. Deployment

Two Vercel projects, one PostgreSQL database on Supabase.

- **API** — [api/vercel.json](api/vercel.json) runs the Laravel app as a PHP function, with
  every path routed to `api/index.php`.
- **Web** — [web/vercel.json](web/vercel.json) builds the SPA and rewrites `/api/*` to the API
  deployment, so the browser only ever talks to one origin. The SPA fallback rewrite keeps
  client-side routes working on refresh.
- **Environment** — the API needs the standard Laravel keys plus the database credentials; the
  SPA needs `VITE_API_URL` (defaulting to `http://localhost:8000/api`, see
  [web/src/lib/api.ts](web/src/lib/api.ts)). No secret is committed to this repository.
- **Scheduled work** — one cron line is the whole story:

  ```
  * * * * * php artisan schedule:run
  ```

Three deployment failures are already documented rather than rediscovered: bootstrap cache,
API origin mismatch, and script-name routing —
[docs/debugging/003](docs/debugging/003-vercel-bootstrap-cache.md),
[004](docs/debugging/004-vercel-api-origin.md), [005](docs/debugging/005-vercel-script-name.md).

---

## 12. Repository map

```
.
├── api/                    Laravel REST API
│   ├── app/
│   │   ├── Console/Commands/   sla:evaluate, task reminders
│   │   ├── Enums/              14 typed domain vocabularies
│   │   ├── Http/               Controllers, Requests, Resources, Middleware
│   │   ├── Models/             23 Eloquent models
│   │   ├── Observers/          ticket resolution side effects
│   │   ├── Policies/           12 resource policies
│   │   └── Services/           29 service classes — all business logic
│   ├── database/migrations/    39 migrations
│   ├── routes/api.php          every endpoint, grouped by guard
│   └── tests/                  Pest suite
├── web/                    React 19 SPA
│   ├── src/app/                shell, navigation, providers
│   ├── src/features/           16 product areas
│   ├── src/i18n/               ar/ + en/ namespaces
│   └── scripts/                the no-hard-coded-strings lint rule
├── docs/
│   ├── requirements/           what the client asked for
│   ├── design/                 the design system + every screen, 4 variants each
│   ├── decisions/              ADRs
│   └── debugging/              10 defect write-ups (Arabic)
├── .squad/
│   ├── stories/                20 specifications
│   └── plans/                  20 implementation plans + index
└── STATUS.md                   one-page current state
```

---

## ملخص بالعربية

**وِصال** نظام دعم عملاء متمركز حول التذكرة: واجهة برمجية بـ Laravel وواجهة مستخدم بـ React،
في مستودع واحد. الموظف يشتغل على طابور تذاكر مرتّب بالأولوية، ويرد على العميل من خيط محادثة
واحد يجمع كل القنوات، وملتزم بأهداف SLA يقيسها محرّك مجدوَل بنفسه. قائد الفريق يرى توزيع
الحِمل والتصعيدات، والمدير يملك المستخدمين والصلاحيات وسياسة الـSLA والتكاملات وفروع المنظمة
وأقسامها وهويتها البصرية. كل شيء يعمل بالعربية والإنجليزية، يمين-لليسار ويسار-لليمين، في الوضع
الفاتح والداكن.

**كيف بُني.** كل ميزة بدأت كتذكرة على Jira، تحوّلت إلى ملف مواصفات (`intake.md`) يحدد النطاق
والقيود وما هو خارج النطاق، ثم إلى خطة تنفيذ مكتوبة، ثم نُفِّذت في جلسة معزولة لا ترى غير ملف
الخطة. عشرون ستوري بهذا الترتيب، وكل مخرجاتها موجودة في المستودع تحت `.squad/`.

**التحقق.** ما لم يُختبَر لا يُعتبر منجزًا. مجموعتا اختبارات تعملان بأمر واحد لكل منهما،
والاختبارات مركّزة على المواضع التي يكون فيها الخطأ مكلفًا: عزل بيانات كل موظف، منع تسريب
الملاحظة الداخلية للعميل، عدم تكرار إشعار SLA، والتعامل السليم مع النطاقات الفارغة في التقارير.
وكل عطل حقيقي واجهناه مكتوب في `docs/debugging/` بالعربية: ماذا حدث، ولماذا، وكيف حُلّ — من
ضمنها حالات أنتج فيها الذكاء الاصطناعي حلًا يبدو صحيحًا وكان خاطئًا، وأمسكه الاختبار لا القراءة.

**النواقص** مكتوبة صراحة في قسم [Known gaps](#10-known-gaps) أعلاه — أهمها أن استخراج النصوص
للترجمة لم يكتمل في تسعة مجلدات، وأن التكاملات سطح إعدادات فقط بلا ربط فعلي بمزوّد خارجي.
