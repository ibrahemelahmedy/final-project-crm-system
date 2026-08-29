# knowledge-base — plan overview

Entry point for the **knowledge-base** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on | Status |
|----|------|-------|------------|------------|--------|
| 09 | [09-story-knowledge-base.md](09-story-knowledge-base.md) | Knowledge Base | WIS-5 | Stories 01, 02, 03, 08 | **implemented** |

## Implemented — what shipped

Every Done Criterion in the story is met. See that file's **Implementation decisions** section for
the choices the contract plan left open (the omitted "Was this helpful?" control, the frozen slug,
and the one endpoint added beyond the table).

**Backend.** `ArticleStatus` enum; `KbCategory` / `KbArticle` / `KbArticleVersion` models with
factories; four migrations (three tables plus a driver-guarded `tsvector` + GIN + trigger migration
that is a no-op on SQLite); `MarkdownRenderer` (Markdown → HTML → allow-list sanitize, plus TOC,
excerpt, read-time, and content-direction detection); `ArticleSearch` with its Postgres and SQLite
implementations bound by driver in `AppServiceProvider`; `ArticleWriter` (the single write path,
holding the version row and the update in one transaction); `KbArticlePolicy`; the article,
category, search, and preview controllers; and `KnowledgeBaseSeeder`, which seeds the artboard's
five categories and articles plus a draft, an Arabic article, and one carrying a script payload so
the visibility, RTL, and sanitization behaviours are all reachable by hand.

**Frontend.** `web/src/features/knowledge-base/` — the index (Story 03's DataTable, category rail,
most-viewed, URL-param filter state, bulk-action bar, all four async states), the reader (breadcrumb,
meta line, sanitized body, `ON THIS PAGE` TOC, content-derived RTL), the Markdown editor with a
server-rendered preview, and `ArticlePickerPanel`, mounted into Story 05's reply composer through
the `onInsertAtCaret` / `toolbarSlot` extension points it already exposed. `App.tsx` now routes
`/knowledge-base` and its three siblings; `navItems.tsx` was not edited, as planned.

**Tests.** 51 backend (`api/tests/Feature/Kb/*` plus the KB shapes appended to `ApiContractTest`)
and 54 frontend (`vitest`) — all green, `tsc` clean, no new lint findings.

**Search on both drivers.** The suite proves the ordering property on SQLite; the PostgreSQL
`ts_rank` path was additionally verified against the live database, where a title match outranks a
body-only match as the contract promises.

## Dependency notes

**This story builds the internal, authenticated agent-facing Knowledge Base only** — the public
Customer Portal view and AI-suggested articles are separate, later concerns. Story 09 is planned at
**contract level**: scope, endpoints, and acceptance criteria are final; task-level file paths are
regenerated immediately before implementation.

- **Depends on** [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md):
  authorship and edit rights derive from `UserRole`'s existing three cases. Reading is open to every
  active authenticated user; authoring is not. **No new role is introduced.**
- **Depends on** [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md):
  the `/knowledge-base` placeholder route this story replaces. The `Knowledge Base` nav entry
  already exists with **no `roles` restriction**, which is correct, so **`navItems.tsx` is not
  edited by this story.**
- **Depends on** [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md)
  for the shared DataTable and the server-side pagination / faceted-filter / URL-filter-state /
  bulk-action pattern. `docs/design/brief.md` names Knowledge Base articles in the same data-table
  heading as Customers — one pattern, two screens.
- **Depends on** [`../users-roles-admin/08-story-users-roles-administration.md`](../users-roles-admin/08-story-users-roles-administration.md)
  for the centralized `EnsureAdministrator` gate, the shared `AuditTrail` service (publish,
  unpublish, and archive write through it), and the `ActiveUserOnly` middleware.
- **Soft dependency on** [`../conversation-thread/05-story-conversation-thread.md`](../conversation-thread/05-story-conversation-thread.md):
  this story owns the article-picker component and the reference format; Story 05's reply composer
  mounts it. If no insertion callback is exposed, the picker still ships standalone from the KB
  index — **this story does not modify Story 05's composer internals without re-planning.**

**Shared contracts this story establishes**, which later stories consume rather than redefine:

- **Tables:** `kb_categories`, `kb_articles`, `kb_article_versions`.
- **`App\Enums\ArticleStatus`** — `draft` · `published` · `archived`. Later stories read these
  values; none redefines them.
- **`/api/kb/*` endpoint group** — articles CRUD, publish/unpublish, bulk actions, categories, and
  `GET /api/kb/search`, which is the endpoint the ticket-side picker and any future "suggested
  solutions" story calls.
- **`KbArticleResource` / `KbArticleSummaryResource`** — the summary resource is the picker's
  contract.
- **`App\Services\ArticleSearch`** — one interface, two implementations: PostgreSQL `tsvector` +
  `ts_rank` with a GIN index, and a `LIKE`-based SQLite fallback ranked title-first. The API
  contract is identical either way, and the tests assert **ordering properties, not engine
  scores**, because local development runs SQLite while PostgreSQL is the target (`STATUS.md`).
- **`App\Services\MarkdownRenderer`** — sanitization happens **server-side on write** into
  `body_html`; the client never renders unsanitized `body`, and the editor preview runs the same
  pipeline.
- **Article reference format**, consumed by Story 05: the Markdown link
  `[<article title>](/knowledge-base/<slug>)`.
- **Frontend `web/src/features/knowledge-base/index.ts`** exporting `KnowledgeBaseIndexPage`,
  `ArticleReaderPage`, `ArticleEditorPage`, and **`ArticlePickerPanel`** — the last being the
  component Story 05 mounts inside the reply composer. Routes: `/knowledge-base`,
  `/knowledge-base/:slug`, `/knowledge-base/new`, `/knowledge-base/:slug/edit`.

All eight design artboards in `docs/design/references/6.Knowledge/` exist in light, dark, LTR, and
RTL — RTL here is a port, not an invention, unlike the Dashboard references.
