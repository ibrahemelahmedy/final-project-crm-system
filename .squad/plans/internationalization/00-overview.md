# internationalization — plan overview

Entry point for the **internationalization** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 15 | [15-story-internationalization.md](15-story-internationalization.md) | Internationalization (Arabic & English) | WIS-11 | Stories 01, 02, and every feature story 03–14 |

## Dependency notes

**This story is client-requirement category 12 (Arabic & English)** — the translation infrastructure
that every other story's "in RTL/Arabic…" acceptance criterion silently depends on. Story 01's plan
deferred to it by name twice ("string catalogues land with the i18n story") before it existed.

**Sequencing, stated honestly.** The intake argues for landing this right after WIS-10. The binding
order puts it at **15**, last. That trade was deliberate: feature stories ship English literals with a
`labelKey`-style key already assigned beside each — the pattern Story 02 set in `navItems.tsx` — so this
story replaces **values**, not structure. The retrofit cost is real and is this story's main body of work.

Story 15 is **contract-level (skeleton)**. It executes after code that does not exist today, so its
scope, contracts, and acceptance criteria are final while its task-level file paths and line ranges
are deliberately absent. **Regenerate it at full depth (`/squad-plan` on the same intake) immediately
before implementing** — the volume of literals left behind by Stories 03–14 is unknowable until that
code exists, and the extraction pass is scoped by the check's output, not by an estimate made now.

- **Depends on** [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md)
  in three specific ways, each of which Story 15 **extends rather than redoes**:
  1. **RTL layout is already done.** Story 02 shipped logical properties throughout the shell, the
     mirrored drawer with its explicit physical `translateX` flip, and `direction: ltr` on the `⌘K`
     badge. Story 15 owns the **strings**, not the mirroring, and creates **no second RTL stylesheet**.
  2. **`UiPreferencesContext` already owns theme AND direction.** Story 15 **extends** it — adds
     `locale`, derives `direction` from it, keeps the existing `wisal-lang` key and its `'ar'`/`'en'`
     values, and preserves Story 02's guarantee that nothing writes to `localStorage` on mount. It does
     **not** replace the provider or create a second one.
  3. **The header language-switcher slot exists and ships inert** (`disabled`, `title="Coming soon"`,
     with a comment naming WIS-11). Story 15 **fills that slot**: no header element is added, moved, or
     reordered. Story 02's Done Criterion that the slot is visibly inert is superseded here.
- **Depends on** [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md):
  Story 01 owns `users`; Story 15 adds the **`locale` column via its own migration** and exposes it on
  `UserResource`.
- **Shared contracts this story establishes:**
  - `users.locale` (`'en' | 'ar'`, default `'en'`) and `PATCH /api/user/preferences` — the only writer.
  - `app/Http/Middleware/SetLocale.php` reading an explicit `Accept-Language` header set by
    `web/src/lib/api.ts`. **The client is the authority** on the chosen locale; the browser's own
    negotiation is irrelevant once signed in, and the locale is not a token claim.
  - `web/src/i18n/` — the configured i18next instance, `useT`, and `formatDate` / `formatDateTime` /
    `formatRelative` / `formatNumber`. **Components never call `Intl` or `toLocaleString` directly.**
  - Catalogues at `web/src/i18n/locales/<en|ar>/<namespace>.json` — `common` (holding the `nav.*` keys
    already in `navItems.tsx`), `auth`, and one namespace per feature slug. Key convention
    `namespace:screen.element`; keys are never composed from runtime fragments.
  - Backend `api/lang/{en,ar}/` for validation, auth, and password strings, including the Arabic
    `attributes` map so `:attribute` interpolates in Arabic.
- **Decisions pinned in the plan** (each demanded explicitly by the intake):
  - **Library: `i18next` + `react-i18next`** (`npm i i18next react-i18next`, major ≥ 23) — chosen for
    real CLDR Arabic plurals via `Intl.PluralRules`, a first-class missing-key handler, and lazy
    namespaces. `react-intl` and `@lingui/react` rejected, with reasons recorded.
  - **Locale formatting is CLIENT-SIDE via the JS `Intl` API.** The PHP `intl` extension is **blocked on
    this dev machine by an Application Control policy** (recorded in Story 01's prerequisites, same
    policy that blocks `pdo_pgsql` per `STATUS.md`). The API returns ISO-8601 UTC timestamps and raw
    numbers and never a pre-formatted string. Arabic uses **Latin digits** (`numberingSystem: 'latn'`)
    so table alignment built against Latin digit widths holds.
  - **The no-hard-coded-strings rule is a deliverable, not a cleanup** — oxlint's
    `react/jsx-no-literals` if the installed oxlint ships it, otherwise a `check-no-literals.mjs` script
    asserted from a Vitest test so `npx vitest run` fails on a violation.
- **Cross-story exception:** [`../csat-collection/13-story-csat-collection.md`](../csat-collection/13-story-csat-collection.md)'s
  public CSAT page has **no signed-in user**. Story 15 absorbs its string module into the shared
  catalogue and **keeps its browser-detected locale rule** — the per-user server preference cannot apply
  where there is no user.
- **Out of scope and owned elsewhere:** Knowledge Base article *content* (Story 09 — author-supplied
  content, not UI strings); multi-branch, multi-department, and custom branding (the rest of category
  12); bidirectional text mixing inside a message body beyond correct `dir` handling.
