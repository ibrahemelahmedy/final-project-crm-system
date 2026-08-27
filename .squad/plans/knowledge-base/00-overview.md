# knowledge-base — plan overview

Entry point for the **knowledge-base** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 09 | [09-story-knowledge-base.md](09-story-knowledge-base.md) | Knowledge Base | WIS-5 | Stories 01, 02, 03, 08 |

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
