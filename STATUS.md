# Status

One-page index. Keep this file **short forever** — it links out, it does not
grow. Any new detail belongs in its own file under `docs/` or `.squad/`, never
pasted in here. Update the "Current phase" line by replacing it, not
appending to it.

**How to use this in a new conversation:** ask Claude to read this file first.
It links to everything else needed to reconstruct context — the product spec,
the design system, and the planning state.

**Reading the project itself?** Start at [README.md](README.md) — that is the
full documentation: architecture, data model, API surface, security, testing,
and how the project was planned and verified. This file is only the live state.

---

## Current phase

**2026-09-06 — All 20 stories implemented; the documentation is published (WIS-21).**
`docs/` and `STATUS.md` were excluded by `.gitignore` and had never been committed —
fixed in `a1fc16c`. [README.md](README.md) is now the project's documentation, with
eight real screenshots of the running app under `docs/screenshots/` (`a9f8794`).

**Live:** https://k1-wisal.vercel.app — verified serving, with `/api/*` reaching the
API deployment. The older `wisal-crm-web.vercel.app` is dead; **the repository's
GitHub About link still points at it and needs one edit in the repo settings.**

Suites green on 2026-09-06: **500 API tests / 2,345 assertions (Pest)** and
**546 web tests across 83 files (Vitest)**; `npm run lint` and `npm run build` clean.
Run the API suite without `--parallel` unless the local Postgres user has `CREATEDB`.

Open, both outside the code: rotate the **Jira API token** and the **Supabase
password** — they sit in plaintext in `docs/requirements/required-for-System-ERP/data.txt`,
which is excluded from git but still live.

Remaining known gap: the **i18n retrofit** (WIS-17). Every catalogue exists in both
languages and every server-sent `*_label` is localised, but the no-hard-coded-strings
check is enforced on ten roots only — nine feature folders (`customers`,
`knowledge-base`, `notifications`, `reports`, `users-roles-admin`, `agent-dashboard`,
`agent-productivity`, `channels`, `csat`) still hold English literals.
`web/scripts/i18n-allowlist.json` is the live list.

## What this project is

**Wisal** (وِصال) — a Customer Support / Helpdesk CRM (ticket-centric, like
Zendesk/Freshdesk/Intercom), built as the deliverable for an AI-Assisted
Full-Stack Engineering Assessment. Full spec: [docs/requirements/client-requirements-raw.md](docs/requirements/client-requirements-raw.md).

## Stack

Laravel 13 API (`api/`, PHP ^8.3) + React 19 / TypeScript SPA on Vite (`web/`).

- **Database: PostgreSQL on Supabase** — `api/.env` runs `DB_CONNECTION=pgsql` against a
  hosted Supabase instance. The SQLite fallback described in earlier revisions of this file
  is no longer in use for development.
- **Tests run on local PostgreSQL** — `api/phpunit.xml` targets `wisal_testing` on
  `127.0.0.1:5432`. SQLite `:memory:` still works by exporting `DB_CONNECTION=sqlite`
  and `DB_DATABASE=:memory:`, which is why every migration and every raw expression must
  stay valid on **both** engines.
- Local tooling: Laravel Herd (PHP 8.4 at `~/.config/herd/bin/php84/php.exe`), Node/npm.

### Running it

```bash
cd api && php artisan serve --port=8000
```

```bash
cd web && npm run dev
```

The SLA engine is a scheduled command, not a queued job — nothing drains the `jobs` table
in this repo. Locally run `php artisan schedule:work`, or invoke it directly:

```bash
cd api && php artisan sla:evaluate
```

`--dry-run` reports without writing; `--backfill` stamps SLA targets on tickets created
before Story 06 landed and is idempotent. In production this is one cron line:
`* * * * * php artisan schedule:run`.

## Design system — done

Full token set (colors, priority, status, typography) and every core UI
pattern built via Claude Design and reviewed screen-by-screen:
[docs/design/brief.md](docs/design/brief.md) — the reference document itself.

Screens, in `docs/design/references/` — **23 folders**, most in four variants
(light/dark × LTR/RTL):

| Folder | Covers |
|---|---|
| `0.Login/` | Login screen: default, loading, invalid-credentials, rate-limited |
| `0.Dashboard/` | Role-based home: Agent, Team Lead, Admin dashboards |
| `1.app-shell/` | Sidebar + header, the persistent shell every screen uses |
| `2.ticket-queue/` | Full ticket list — filters, priority/status columns, bulk actions |
| `3.Conversation Thread/` | Ticket detail — multi-channel message thread, AI-suggested reply |
| `4.Data Table/` | Customers table + its empty/loading states |
| `5.Modals/` | Create/edit forms and destructive-action confirmation |
| `6.Knowledge/` | Knowledge Base index + article reading view |
| `7.Admin Reports/` | Users, SLA Rules, Reports (charts) |
| `8.`–`11.` | Quick replies (management, picker), ticket tasks, internal-note thread |
| `12.`–`14.` | Notifications centre, CSAT response, Channels overview |
| `15.`–`17.` | Customer Portal access (2 steps), AI Assist panel |
| `18.`–`21.` | Integrations admin, Organization settings (branding, departments, branches) |

Rendered screenshots of the **running app** (not designs) are separate:
`docs/screenshots/`, embedded in [README.md](README.md).

Every batch was reviewed for: structural parity across light/dark/LTR/RTL,
WCAG contrast (computed, not assumed), and a recurring bug pattern worth
knowing about — a CSS class referenced in markup with no rule defined in
`<style>` (`fv`/`fvd` for focus-visible, `sk` for skeletons). Always grep for
this before trusting a new export.

## Planning — squad-kit

Workflow explained in [.squad/README.md](.squad/README.md). Live state:
`squad status` and `squad list`, or [.squad/plans/00-index.md](.squad/plans/00-index.md).

The index's **Depth** column records plan depth (`full` / `contract`) and flips to
`implemented` via the `index-sync` Stop hook once a story's Done Criteria are all ticked.
**Ticking those boxes is the project owner's step, not Claude's** — the checkbox is the
owner's acceptance of the work, so an agent never ticks it on its own.

Three staff roles used consistently across every design screen: **Agent**,
**Team Lead/Supervisor**, **Administrator**. The Customer Portal — deferred out
of the first nine stories as external-facing — **shipped as WIS-16**, with its own
identity model (one-time access codes, a separate session table, never a staff
token): [ADR-005](docs/decisions/ADR-005-customer-portal-access.md).

## Working agreement

An agent working on this repo guides first — gives the exact commands, prompts and
drafts to review — and executes directly only on an explicit go-ahead. Established
after two corrections early in the project: scaffolding files and running generators
unasked both cost more time than they saved.
