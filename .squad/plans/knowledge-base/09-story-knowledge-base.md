# Story 09 — Knowledge Base (Story: WIS-5)

> **Contract-level plan.** Stories 01–02 are implemented; this story executes after Story 08.
> Scope, contracts, and acceptance criteria below are final. Task-level file paths and line
> ranges are deliberately absent — regenerate this plan at full depth (`/squad-plan` on the same
> intake) immediately before implementing, once the code it builds on exists.

## Prerequisites

- **Story 01 completed** — [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md).
  Supplies `App\Enums\UserRole` (`agent` · `team_lead` · `administrator`) and `UserResource`.
  Authorship and edit rights are derived from these three roles — **no new role is introduced.**
- **Story 02 completed** — [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md).
  Supplies `AppLayout`, `UiPreferencesContext` (theme + direction), and the **`/knowledge-base`
  placeholder route this story replaces**. The `Knowledge Base` nav entry already exists in
  `navItems.tsx` with **no `roles` restriction** — it is visible to every role, which is correct;
  reading is universal, authoring is not.
- **Story 03 completed** — [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md).
  Owns the shared **DataTable** component and the server-side pagination / faceted-filter /
  URL-filter-state / bulk-action pattern. **This story reuses it; it does not build a second table.**
- **Story 08 completed** — [`08-story-users-roles-administration.md`](../users-roles-admin/08-story-users-roles-administration.md).
  Supplies the centralized `EnsureAdministrator` gate, the `AuditTrail` service, and the
  `ActiveUserOnly` middleware. Article publish/unpublish and delete call `AuditTrail`; they do not
  write audit rows directly.
- **Coordination, soft dependency:** Story 05
  (`../conversation-thread/05-story-conversation-thread.md`) owns the reply composer. This story
  ships the article-picker component and the reference format; Story 05's composer mounts it. See
  *Edge Cases* for the agreed fallback if the composer's insertion point is not yet available.

---

## Story Goal

Build the internal, authenticated agent-facing Knowledge Base: an article index with the Customers
data-table pattern, a reader view, authoring with draft/published lifecycle, and relevance-ranked
search.

1. Any signed-in user can browse the KB index — category rail, "Most viewed" list, and the article
   list — and open an article in the reader view.
2. An Administrator (or a Team Lead acting as editor) can create, edit, publish, unpublish, and
   archive an article. **Title, body, and category are all required before publishing.**
3. A **Draft** article does not appear in agent-facing search or in the article list for
   non-authors, and is unreachable by direct URL for a non-editor.
4. Search ranks results by relevance against **title and body together**; an empty result set shows
   an Empty state suggesting a broader query, never a blank list.
5. An agent inside a ticket can search the KB and insert an article reference into their reply
   without leaving the ticket.
6. The reader renders Markdown safely — article bodies are sanitized **server-side** and no raw HTML
   from a body ever reaches the DOM unsanitized.
7. Arabic articles render RTL in the reader with the brief's Arabic line-height rule applied.
8. Editing a published article records a new version row and updates a visible last-updated
   timestamp.

**Explicitly NOT in scope:**

- The public / unauthenticated Customer Portal view of the KB.
- AI-suggested articles and AI-generated summaries.
- Article comments and "Was this helpful?" ratings. *(Note: the reader artboard renders a "Was this
  article helpful? / Yes" control. It is ported as **visually present but inert**, or omitted —
  the regenerated plan picks one and says so. No ratings table is created.)*
- Rich-text WYSIWYG authoring. The editor is a Markdown textarea with a preview pane.
- File attachments on articles.

---

## Context — Read These Files First

Verified to exist at plan time. For anything a future story owns, the owning plan is named instead
of a path.

1. `docs/design/references/6.Knowledge/WisalKBIndex-LightLTR.dc.html` — **122 lines, the primary
   index reference.** Header "Knowledge Base" with the "86 articles" subtitle; the left rail with
   the `CATEGORIES` label and the entries **All Articles · Account & Access · Billing ·
   Integrations · Notifications · Troubleshooting**; the `MOST VIEWED` list; and the article card
   shape — an uppercase category eyebrow, an `Updated <date>` line, then the title.
2. `docs/design/references/6.Knowledge/WisalKBArticle-LightLTR.dc.html` — **133 lines, the reader.**
   The breadcrumb `Knowledge Base / Account & Access / <title>`; the category eyebrow; the
   `Last updated Aug 20, 2026 · 4 min read` meta line; in-body section headings; the right-hand
   `ON THIS PAGE` table of contents; and the "Was this article helpful?" footer.
3. `WisalKBIndex-LightRTL.dc.html`, `WisalKBArticle-LightRTL.dc.html`, and both `-Dark*` variants —
   **all eight files exist**, so RTL and dark are a port, not an invention. **These are the only RTL
   artboards among this story's references; use them to verify the rail and TOC move to the visual
   left.**
4. **Grep before porting any CSS.** `WisalKBIndex-DarkLTR` and `-DarkRTL` carry `class="fvd"`; the
   light index files and all four article files carry `class="fv"`. Grep every `class="…"` against
   the file's `<style>` block before assuming a rule exists — the recurring export defect in
   `STATUS.md`.
5. `docs/design/brief.md` — **"Data table (Customers, Knowledge Base articles)"** (this story is
   named in that heading), **"Required states per view"**, **"Internationalization"** (the reader's
   breadcrumb chevrons mirror), **"Accessibility"**, and the **Arabic typography / line-height**
   rule in the token section.
6. `.squad/stories/knowledge-base/WIS-5/intake.md` — the acceptance criteria the Done Criteria map
   to 1:1. `attachments/` is empty.
7. `api/database/migrations/2026_08_25_200000_create_audit_logs_table.php` — read the pgsql `jsonb`
   promotion block. **The full-text-search migration follows the same
   `DB::connection()->getDriverName() === 'pgsql'` conditional pattern**, because local development
   runs SQLite per `STATUS.md`. `api/routes/api.php` — the `auth:sanctum` group the new routes join.
8. `web/src/App.tsx` — the `/knowledge-base` route currently rendering `PagePlaceholder`.
   `web/src/app/navigation/navItems.tsx` — confirm the `Knowledge Base` entry has no `roles` key and
   therefore needs no edit.
9. [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md)
   — its DataTable contract, bulk-action bar, and URL-search-param convention, before writing the
   article index.

---

## Shared contracts this story establishes

Later stories may cite these. This story owns them.

**Backend — `api/`**

| Endpoint | Method | Notes |
|---|---|---|
| `/api/kb/articles` | `GET` | server-paginated; filters `category`, `status`, `q`; drafts excluded for non-editors |
| `/api/kb/articles` | `POST` | create; `title`, `body`, `category_id` required to publish |
| `/api/kb/articles/{article}` | `GET` | reader payload, sanitized body |
| `/api/kb/articles/{article}` | `PATCH` | edit; writes a version row when the article is published |
| `/api/kb/articles/{article}/publish` | `POST` | draft → published; validates required fields |
| `/api/kb/articles/{article}/unpublish` | `POST` | published → draft |
| `/api/kb/articles/bulk` | `POST` | bulk publish / unpublish / archive, for the bulk-action bar |
| `/api/kb/categories` | `GET` | the left-rail categories with article counts |
| `/api/kb/search` | `GET` | relevance-ranked; **the endpoint the ticket-side picker calls** |

- **Tables owned here:** `kb_categories` (`name`, `slug`, timestamps), `kb_articles`
  (`title`, `slug`, `body`, `body_html`, `excerpt`, `kb_category_id`, `status`, `author_id`,
  `published_at`, `view_count`, timestamps), `kb_article_versions` (`kb_article_id`, `title`,
  `body`, `edited_by`, `created_at`).
- **`App\Enums\ArticleStatus`** — `Draft = 'draft'` · `Published = 'published'` ·
  `Archived = 'archived'`. **Owned here. Later stories read these values and never redefine them.**
- **`App\Http\Resources\{KbArticleResource, KbArticleSummaryResource}`** — the summary resource is
  what the ticket-side picker and any later "suggested solutions" story consumes.
- **`App\Policies\KbArticlePolicy`** — read is open to every active authenticated user; create,
  update, publish, and archive require Administrator or Team Lead. Built on Story 08's gate layer.
- **Sanitization is server-side and happens on write**: Markdown → HTML → allow-list sanitizer,
  stored in `body_html`. The raw `body` is retained for editing. **The client never renders
  unsanitized `body`.**
- **Search:** on PostgreSQL, a `tsvector` column with a GIN index and `ts_rank` over
  `setweight(title, 'A') || setweight(body, 'B')`. On SQLite, a `LIKE`-based fallback ranked
  title-match-first. Both live behind one `App\Services\ArticleSearch` interface so the API contract
  is identical either way.
- **Audit:** publish, unpublish, and archive call Story 08's `AuditTrail` with the event names
  `kb_article.published` · `kb_article.unpublished` · `kb_article.archived`.

**Frontend — `web/src/features/knowledge-base/`**

- Standard folder shape; `index.ts` is the only public surface.
- Public exports: `KnowledgeBaseIndexPage`, `ArticleReaderPage`, `ArticleEditorPage`, and
  **`ArticlePickerPanel`** — the last is the component Story 05 mounts inside the reply composer.
- Routes owned here: `/knowledge-base` (replacing the placeholder), `/knowledge-base/:slug`,
  `/knowledge-base/new`, `/knowledge-base/:slug/edit`.
- **Article reference format, owned here and consumed by Story 05:** a Markdown link
  `[<article title>](/knowledge-base/<slug>)` inserted at the composer's caret. Story 05 supplies
  the insertion callback; **this story does not touch the composer's internals.**
- Filter, category, and search state live in **URL search params**, matching Story 03.
- **`navItems.tsx` is not edited.**

---

## Implementation outline

Bullet level by design. File-by-file detail is regenerated before implementation.

### Backend

Everything below is **owned by this story** unless the bullet names another owner.

- **Migrations** creating `kb_categories`, `kb_articles`, `kb_article_versions`, plus a
  driver-conditional migration adding the `tsvector` column, its GIN index, and the trigger keeping
  it current **on pgsql only** — following the `getDriverName()` pattern already used by the
  audit-log migration.
- **`ArticleStatus` enum**, the three models, their factories, and a seeder producing the categories
  and a realistic article set for the index's Empty and Success states.
- **`ArticleSearch` service** with the pgsql and SQLite implementations behind one interface. The
  "suggested solutions" successor story reuses it.
- **`MarkdownRenderer` service** — Markdown → HTML → allow-list sanitize, called on every write.
  Script tags, event-handler attributes, `javascript:` URLs, `<iframe>`, and `<object>` are stripped.
- **`KbArticleController`**, **`KbCategoryController`**, **`KbSearchController`** — thin, delegating
  to the services; routes registered in `api/routes/api.php` behind `auth:sanctum`.
- **`KbArticlePolicy`** built on **Story 08's** gate layer; a draft is invisible to a non-editor at
  the **query** level, not merely hidden in the response.
- **Version write on edit** inside the same transaction as the update, so a failed sanitize never
  leaves a version row without its article state.

### Frontend

Everything below is **owned by this story** unless the bullet names another owner.

- `web/src/features/knowledge-base/` with the standard folder shape.
- **`KnowledgeBaseIndexPage`** — category rail, "Most viewed" list, search input, and the article
  list built on **Story 03's** DataTable with the bulk-action bar for editors. All four async states.
- **`ArticleReaderPage`** — breadcrumb, category eyebrow, meta line, sanitized body, and the
  `ON THIS PAGE` TOC generated from the rendered headings.
- **`ArticleEditorPage`** — Zod-validated Markdown editor with a live preview rendering the **same
  sanitized pipeline output**, a category select, and separate Save-draft and Publish actions.
- **`ArticlePickerPanel`** — a search-and-insert panel taking an `onInsert(markdown: string)`
  callback. Usable standalone; **Story 05** wires it into the composer.
- Swap `web/src/App.tsx`'s `/knowledge-base` element from `PagePlaceholder` to
  `KnowledgeBaseIndexPage` and add the three sibling routes. The route tree is **Story 02's**; this
  is the sanctioned replacement.
- **RTL and Arabic typography:** the reader sets `dir` from the article's detected content
  direction, independent of the app-wide direction, and applies the brief's Arabic line-height rule.
  An Arabic article read by an English-UI user still renders RTL **inside the article body only**.
- **No change to `navItems.tsx`, `AppLayout.tsx`, `UiPreferencesContext.tsx`, or `lib/api.ts`.**

---

## Edge Cases & Failure Modes

- **Publishing with a missing field.** Publish validates `title`, `body`, and `category_id`
  server-side and returns 422 naming the missing field. Saving a **draft** does not require them —
  only publishing does.
- **A draft reached by direct URL.** A non-editor gets 404, **not** 403 — a 403 leaks that the slug
  exists. Enforced at the query level in the policy scope.
- **A draft appearing in search.** The search query filters on `status = published` for non-editors
  before ranking, not after. An editor's search includes their drafts, labelled.
- **Empty search result.** Renders the Empty state suggesting a broader query, with the query echoed
  back. Never a blank list and never a spinner that resolves to nothing.
- **Stored XSS in a body.** Sanitized on **write** into `body_html`; the reader renders only
  `body_html`. The editor preview runs the same pipeline, so a payload cannot survive by being
  previewed instead of saved. **Client-side sanitization alone is explicitly insufficient.**
- **Markdown that generates duplicate heading ids.** TOC anchors are de-duplicated with a suffix, or
  the TOC entry is dropped rather than linking to the wrong section.
- **A slug collision on rename.** Slugs are unique; a collision appends a numeric suffix. **An
  existing published slug is never silently repointed** — the old slug 301s to the new one or the
  rename is rejected; the regenerated plan picks one and states it.
- **Mixed-direction content.** An Arabic article with embedded English code blocks: the body is
  `dir="rtl"` but `<pre>`/`<code>` carry an explicit `direction: ltr`, following the precedent of
  the app-shell export's `⌘K` badge.
- **Concurrent edits to one article.** Last write wins; each write creates a version row, so nothing
  is lost. No optimistic-locking column is added.
- **`view_count` under concurrency.** Incremented with an atomic DB increment, not a read-modify-write.
  It is a soft metric — an occasional lost increment is acceptable and is not tested for exactness.
- **Search on SQLite vs. PostgreSQL.** *Stated uncertainty:* `STATUS.md` records that local
  development runs SQLite because `pdo_pgsql` is blocked by Windows Application Control, with
  PostgreSQL as the target. **Relevance ranking will therefore differ between local and target.**
  The API contract and the tests assert *ordering properties* (a title match outranks a body-only
  match) rather than exact `ts_rank` scores, so the suite passes on both drivers.
- **The composer insertion point.** *Stated uncertainty:* Story 05 executes **before** this story in
  the sequence, but its composer's extension API is not readable at plan time. If no insertion
  callback exists, `ArticlePickerPanel` still ships and is reachable standalone from the KB index;
  the regenerated plan binds it to whatever Story 05 actually exposes. **Do not modify Story 05's
  composer from this story without re-planning.**
- **"Was this helpful?" in the artboard.** *Stated uncertainty:* ratings are explicitly out of
  scope, yet the reader artboard renders the control. It ships inert or omitted — decided in the
  regenerated plan. **No ratings table is created either way.**

---

## Test Plan

**Backend (Pest, `api/tests/Feature/`) — follow `api/tests/Feature/TicketScopeTest.php` for the
role-scoped assertions and `ApiContractTest.php` for shape assertions.**

1. `Kb/ArticleCrudTest.php` — an editor creates a draft with only a title; **publishing without a
   body or category returns 422**; a published article carries a `published_at`.
2. `Kb/ArticleVisibilityTest.php` — a draft is absent from `GET /api/kb/articles` for an Agent and
   absent from `GET /api/kb/search`; fetching a draft by slug as an Agent returns **404, not 403**;
   an editor sees it.
3. `Kb/ArticleAuthorizationTest.php` — an Agent receives 403 on create, update, publish, and bulk;
   an Agent receives 200 on list, show, and search.
4. `Kb/ArticleSearchTest.php` — a query matching a title outranks a query matching only a body; a
   no-match query returns an empty collection with a 200; asserts ordering properties, **not**
   engine-specific scores, so it passes on both SQLite and pgsql.
5. `Kb/ArticleSanitizationTest.php` — a body containing `<script>`, an `onerror=` attribute, a
   `javascript:` href, and an `<iframe>` is stored with all four stripped from `body_html`, and the
   raw `body` is retained unchanged for editing.
6. `Kb/ArticleVersioningTest.php` — editing a published article inserts exactly one
   `kb_article_versions` row and moves `updated_at`; editing a draft is covered by the same path.
7. Extend `api/tests/Feature/ApiContractTest.php` with the article, category, and search response
   shapes so the ticket-side picker's contract cannot drift.

**Frontend (Vitest + Testing Library, `web/src/features/knowledge-base/`).**

8. `KnowledgeBaseIndexPage.test.tsx` — renders the category rail and article list; all four async
   states; selecting a category and typing a query both write to URL search params and survive a
   reload; the Empty state copy suggests broadening the search.
9. `ArticleReaderPage.test.tsx` — renders sanitized HTML (a script payload in the fixture does not
   execute and does not appear in the DOM); the `ON THIS PAGE` TOC links to the rendered headings;
   an Arabic fixture sets `dir="rtl"` on the body while a `<pre>` inside it stays `ltr`.
10. `ArticleEditorPage.test.tsx` — Publish is blocked by the Zod schema without a category; the
    preview pane output matches the reader's rendering of the same source.
11. `ArticlePickerPanel.test.tsx` — searching and choosing a result calls `onInsert` with exactly
    `[<title>](/knowledge-base/<slug>)`; an empty result set renders the Empty state.
12. `kbRoutes.test.tsx` — following `web/src/app/navigation/navRoutes.test.tsx`: `/knowledge-base`
    resolves to the index for every role, and `/knowledge-base/new` is refused for an Agent.

---

## Verification Steps

1. **Migrations apply cleanly:** `cd api && php artisan migrate:fresh --seed` — the three KB tables
   exist and the seeder populates categories and articles.
2. **Backend tests pass:** `cd api && ./vendor/bin/pest` — all `Kb/*` tests green, no regression in
   the `Auth/*` or `Admin/*` suites.
3. **Routes registered:** `cd api && php artisan route:list --path=kb` — every route inside the
   `auth:sanctum` group.
4. **Frontend tests pass:** `cd web && npx vitest run` (**there is no `test` script in
   `web/package.json`**).
5. **Lint clean:** `cd web && npm run lint` — no new findings.
6. **Regression, manual:** `cd web && npm run dev`; as an Agent, confirm `/knowledge-base` lists only
   published articles, search returns ranked results, and an article with a scripted body renders
   inert; as an Administrator, create a draft and confirm the Agent's session cannot see it.
7. **RTL and dark check:** open an Arabic article and toggle direction and theme; confirm the
   category rail and `ON THIS PAGE` TOC move to the visual left and match the RTL artboards.

---

## Implementation decisions

Recorded at implementation time. Each resolves a choice this plan deliberately left open.

- **"Was this helpful?" — OMITTED, not shipped inert.** The reader artboard renders the control, but
  ratings are out of scope. Depicting a control the product cannot honour is worse than leaving it
  out, which is the same call Story 05 made for the AI-suggested-reply slot. No ratings table exists.
  `ArticleReaderPage.test.tsx` asserts its absence so it cannot reappear by accident.
- **Slug collision on rename — the slug is FROZEN at creation.** `KbArticle::freshSlug()` derives it
  once and appends a numeric suffix on collision; a later title change never repoints it. No redirect
  table and no 301 are needed, and an existing published slug can never be silently reused for
  different content — a `[title](/knowledge-base/<slug>)` reference pasted into a ticket reply months
  ago still resolves. The reader shows the current title regardless.
- **One endpoint added beyond the table above: `POST /api/kb/preview`.** The plan requires that "the
  editor preview runs the same pipeline, so a payload cannot survive by being previewed instead of
  saved", and that client-side sanitization alone is insufficient. Together those rule out rendering
  Markdown in the browser, so the preview is a server render through the same `MarkdownRenderer`.
  It writes nothing and touches no row, but carries the authoring policy rather than the read policy.
- **The picker IS wired into the composer.** Story 05 shipped `onInsertAtCaret` and `toolbarSlot` on
  `ReplyComposer` for exactly this. `TicketDetailPage` passes `ArticlePickerPanel` through those two
  existing extension points; **no composer internals were modified**, so the plan's re-planning
  condition was not triggered.
- **Search relevance is asserted as an ordering property, never a score.** Verified on both engines:
  the suite runs `LikeArticleSearch` on SQLite, and `PostgresArticleSearch` was exercised against the
  live PostgreSQL, where `ts_rank` returns the title match ahead of the body-only matches.

## Done Criteria

Mapped 1:1 to `.squad/stories/knowledge-base/WIS-5/intake.md`.

- [x] An Administrator or authorized editor creating an article must supply a title, body, and
      category before it can be published.
- [x] An article saved as Draft is not visible in agent-facing search or to a non-editor until
      explicitly Published.
- [ ] The article list uses the same server-side pagination, faceted filter, and bulk-action pattern
      as Customers (Story 03), with filter state reflected in the URL.
- [x] Search ranks results by relevance against title and body; an empty result set shows an Empty
      state suggesting a broader search, not a blank list.
- [ ] An agent inside a ticket's Conversation Thread can search the Knowledge Base and insert an
      article reference into their reply without leaving the ticket.
- [x] The reader view renders Markdown safely — no raw HTML from an article body reaches the DOM
      unsanitized, and sanitization happens server-side.
- [x] An Arabic-authored article renders RTL in the reader with the Arabic line-height rule from
      `docs/design/brief.md`.
- [x] Editing a published article records a version and updates a visible last-updated timestamp so
      agents can tell if guidance is stale.
- [x] `web/src/App.tsx` no longer renders `PagePlaceholder` at `/knowledge-base`.
- [x] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 10.**
