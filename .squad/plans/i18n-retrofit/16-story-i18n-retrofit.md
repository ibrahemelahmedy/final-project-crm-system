# Story 16 — i18n String Extraction Retrofit: Complete WIS-11 Coverage (Story: WIS-17)

> **Full-depth plan.** Every path, line number, and count below was verified against the working tree
> on 2026-09-02. WIS-11 (Story 15) shipped the i18n **infrastructure** and migrated two feature
> folders. This story closes the retrofit across the remaining eleven roots that
> `web/scripts/i18n-allowlist.json`'s `_rootsNote` lists as pending.
>
> **The intake's acceptance criteria are marked "draft — refine during planning."** They are refined
> here, and the one place where two of them conflict is resolved explicitly in
> **Decision 1**. Read that before anything else.

## Prerequisites

- **Story 15 / WIS-11 completed** ([`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md)).
  Its machinery is **consumed, not redesigned** (intake, Dependencies):
  - `web/src/i18n/instance.ts` (i18next 26, JSON v4 plurals, `missGuard`, `parseMissingKeyHandler`),
    `web/src/i18n/index.ts` (`useT` at **:25–28**, `NAMESPACES`), `web/src/i18n/formatters.ts`
    (`formatDate` / `formatDateTime` / `formatRelative` / `formatNumber`, `numberingSystem: 'latn'`).
  - `web/src/app/providers/UiPreferencesContext.tsx` — `locale` source, `direction` derived (**:56, :64**),
    `<html lang>`/`<html dir>` (**:93–94**), `setLocale` persists + PATCHes (**:117–129**).
  - `web/src/lib/api.ts:43–52` — the `Accept-Language` interceptor.
  - `web/scripts/check-no-literals.mjs` + `web/scripts/i18n-allowlist.json` + `npm run i18n:check`
    (wired into `npm run lint` via `web/package.json`) + `web/src/i18n/noHardcodedStrings.test.ts`.
  - `api/`: `users.locale`, `PATCH /api/user/preferences`, `SetLocale` at `api/bootstrap/app.php:38`,
    `api/lang/{en,ar}/{auth,enums,passwords,sla,validation}.php`.
  **Nothing in the list above changes in this story**, with the single narrow exception in Task 1.
- **Stories 03–14 completed** — the code whose literals get extracted.
- **Story 13** ([`../csat-collection/13-story-csat-collection.md`](../csat-collection/13-story-csat-collection.md))
  — its public CSAT page has no signed-in user; its browser-detection rule survives this story verbatim.
- **Baseline, measured 2026-09-02.** `npx vitest run` in `web/` → **64 files, 424 tests, all passing**.
  `node scripts/check-no-literals.mjs` → passes over its 4 configured roots. Backend: ~10 `Customer*`
  Pest tests fail on `main` independently of this work — that is the clean baseline, not a regression
  from here.

---

## Story Goal

Move the hard-coded English literals in the eleven pending roots into the existing translation
namespaces, following the pattern `src/features/auth` and `src/features/sla-rules` already established,
and add each root to `web/scripts/i18n-allowlist.json`'s `roots` array as its migration completes.
`roots` is the acceptance signal; `_rootsNote` is the pending list this story deletes.

1. All **12** empty feature catalogues under `web/src/i18n/locales/{en,ar}/` are populated in both locales.
2. All **11** pending roots are in `roots`, and the check passes with zero unlisted-literal violations.
3. An Arabic screen in a migrated folder shows **no English** — which, per Decision 1, requires the
   check to see three literal shapes it is currently blind to.
4. New non-translatable tokens found during migration are added to `literals` / `patterns` **with a
   reason**, never left unlisted.

**Explicitly out of scope**, per the intake and confirmed during planning:

- **New translatable copy or features.** This is a retrofit of existing UI text only.
- **Non-text RTL / layout defects.** WIS-11's existing surface.
- **Backend English.** Only 6 of 143 PHP files under `api/app` call `__()`; 7 enums, 7 Request classes,
  and several services return raw English that reaches an Arabic screen. **This is real and verified,
  and it is not WIS-17.** The inventory is preserved in *Found during planning — outside this story*
  below so it can be filed as its own tracker item.
- **Rewiring every date/number through `web/src/i18n/formatters.ts`, and any new enforcement rule for
  it.** Only the locale bugs *inside the eleven migrated folders* are fixed here (Task 3).
- The four deferred categories (AI, Customer Portal, Integrations/ERP, Platform multi-tenant).

---

## Context — Read These Files First

1. [`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md)
   — **Shared contracts this story establishes** (key convention `namespace:screen.element`, the
   namespace table) and **Decisions this story makes explicitly** (client-side `Intl`, Latin digits).
   Inherited unchanged.
2. `web/scripts/check-no-literals.mjs` — read end to end (154 lines). Both rules live in `scanSource`
   (**:68–102**): `ts.isJsxText` at **:73**, and the attribute rule at **:78–93**. `TARGET_ATTRS`
   (**:37**) is exactly `title`, `aria-label`, `placeholder`, `alt`. `collectFiles` (**:49–66**) takes
   **`.tsx` only** (**:62**). `runCheck` (**:109–120**) reads `config.roots` — which is why the
   allowlist file is the single control point and the intake can call `roots` the acceptance signal.
3. `web/scripts/i18n-allowlist.json` — **lines 3–8** the four enforced roots; **line 9** the
   `_rootsNote` pending list this story deletes; **lines 10–19** the exemptions, which grow (with
   reasons) and never loosen.
4. `web/src/i18n/index.ts:25–28` — `useT(ns)` pins a namespace and keeps `common` as fallback.
   Components import from here and nowhere deeper.
5. `web/src/i18n/catalogueParity.test.ts` — **:19** `AR_PLURAL_SUFFIXES`, **:23–25** `collapsePlurals`,
   **:47–62** the six-form assertion. **This test passes today only because the twelve feature
   catalogues are `{}`.** It becomes a real gate the moment they are populated.
6. `web/src/i18n/locales/{en,ar}/sla.json` — the worked precedent for a populated namespace, including
   `subtitle_{zero,one,two,few,many,other}` (`ar/sla.json:3–8`) and the nested `duration.minutes_*` block.
7. `web/src/features/sla-rules/` — the worked precedent for a converted feature: `useT('sla')` at
   `components/DurationField.tsx:28`, `SlaRuleCard.tsx:33`, `SlaRuleFormModal.tsx:52`,
   `SlaRulesEmpty.tsx:10`, `SlaRulesError.tsx:10`, `pages/SlaRulesPage.tsx:23`. Its
   `pages/SlaRulesPage.tsx:51` — `t('subtitle', { count: activeCount })` — is the **only correct
   pluralization site in the codebase**. Copy that shape.
8. `web/src/features/sla-rules/model/formatDuration.ts:31–43` — the precedent for localizing a `.ts`
   module (`t` passed in). **Read its flaw:** `t` is optional, so **:42** keeps
   `` `${value} ${singular}${value === 1 ? '' : 's'}` `` alive inside a migrated feature.
9. `web/src/features/tickets/model/display.ts` — the archetype: label maps at **:21–27**, **:28–34**,
   **:35–42**, **:44–50**, none of which any current rule can see.
10. `web/src/features/csat/model/csatStrings.ts:1–8` — the file header instructs WIS-11 to absorb this
    module **while keeping the browser-detection rule**. It was not absorbed. `detectCsatLocale`
    (**:113–115**) and `csatDir` (**:117–119**) survive unchanged.
11. `docs/design/brief.md` `## Internationalization` (**lines 199–206**) — RTL mirrors table **column
    order**, relevant to every `columns.tsx` touched here.

Run these before starting, to see the shape of the work:

- `cd web && node scripts/check-no-literals.mjs src/features/tickets` — 91 violations, the largest root.
- `cd web && node scripts/check-no-literals.mjs src/components src/features/customers …` — 396 total.

---

## Measured scope (verified 2026-09-02, not estimated)

**Tier 1 — literals the *current* rules would flag once the roots are added: 396.**

| Root | Violations | Target namespace |
|---|---:|---|
| `src/features/tickets` (excl. `components/thread/`) | 52 | `tickets` |
| `src/features/tickets/components/thread/` | 39 | `conversation` |
| `src/features/agent-productivity` | 63 | `productivity` |
| `src/features/customers` | 57 | `customers` |
| `src/features/knowledge-base` | 48 | `knowledge` |
| `src/features/users-roles-admin` | 40 | `users` |
| `src/features/agent-dashboard` | 24 | `dashboard` |
| `src/features/reports` | 21 | `reports` |
| `src/features/notifications` | 20 | `notifications` |
| `src/components` (`data-table` 11 + `ui` 2) | 13 | `common` |
| `src/features/channels` | 10 | `channels` |
| `src/features/csat` | 9 | `csat` |
| **Total** | **396** | |

**Two mappings the intake leaves implicit, pinned here.** There is no `web/src/features/conversation/`;
the conversation thread is `web/src/features/tickets/components/thread/` (20 files) and owns the
**`conversation`** namespace — so the intake's single `src/features/tickets` entry funds **two**
catalogues. And `src/components` is shared chrome, so it extends **`common`** rather than gaining a
namespace of its own.

**Tier 2 — roughly 246 further literals that stay invisible even after the roots are added**, in three
shapes. This is the evidence behind Decision 1.

1. **`.ts` files are never opened** (`check-no-literals.mjs:62`): `tickets/model/display.ts:21–50`,
   `tickets/model/columns.ts:28–36` (9 column labels), `channels/model/channel.ts:40–121` (14 labels +
   help lines), `users-roles-admin/model/adminUser.ts:12–14`,
   `users-roles-admin/model/relativeTime.ts:13,16,22`, `agent-productivity/model/dueStateLabel.ts:14–44`,
   `agent-dashboard/model/greeting.ts:4`, `notifications/model/notificationTime.ts:16`,
   `csat/model/csatStrings.ts:43–74`.
2. **Prose in props outside `TARGET_ATTRS`** — `emptyMessage`, `errorMessage`, `body`, `caption`,
   `confirmLabel`, `cta`, `label`, `heading`, `message`, `emptySummary`. **21** bare-literal instances,
   e.g. `agent-dashboard/components/SlaRiskWidget.tsx:32–33`,
   `reports/components/TicketVolumeCard.tsx:22,24`,
   `users-roles-admin/pages/AuditLogPage.tsx:169,181,197`, `tickets/pages/TicketDetailPage.tsx:120`.
3. **Ternaries and template literals in JSX expression containers**, which `scanSource` walks past
   because it matches only `ts.isStringLiteral` initializers (**:81–89**). ~25 sites, e.g.
   `users-roles-admin/components/StatusPill.tsx:9`, `tickets/components/SlaCell.tsx:36`,
   `tickets/components/thread/ActivityList.tsx:8–20` (7 templated sentences),
   `components/data-table/DataTable.tsx:89`, `components/data-table/ColumnMenu.tsx:23`.

**Tier 3 — locale bugs inside the eleven folders** (Task 3; the enforcement rule for them is out of scope):

- **21 direct `Intl` / `toLocale*` sites in 15 files. All 14 `Intl` constructions pass `undefined`** as
  the locale, and **9 are module-level constants** — bound at import, unable to follow a language
  switch: `users-roles-admin/model/relativeTime.ts:8,39`, `agent-productivity/model/dueStateLabel.ts:8,9`,
  `notifications/model/notificationTime.ts:9`, `knowledge-base/model/columns.tsx:8`,
  `customers/model/columns.tsx:8`, `customers/components/InteractionHistory.tsx:5`,
  `customers/components/NotesPanel.tsx:4`.
- `reports/model/report.ts:111` hard-codes `'en-US'` — that axis **never** becomes Arabic.
- `csat/pages/CsatResponsePage.tsx:24` maps by hand to **`'ar-EG'`**, rendering **Eastern Arabic
  numerals** — contradicting WIS-11's Latin-digits decision.
- `reports/components/CsatCard.tsx:25,37` use `.toFixed(2)` — a hard-coded decimal separator.
- **13 naive `count === 1` plural sites.** These are English string literals in components, so they are
  Tier-1 work regardless (Task 4).
- `web/src/i18n/formatters.ts` has **zero importers**; the only `formatDate` outside `src/i18n/` is a
  local shadow at `csat/pages/CsatResponsePage.tsx:21`.

---

## Decisions this story makes explicitly

**1 — AC1 and AC2 conflict under the current checker. Coverage is extended; the mechanism is not
redesigned.**

The intake's Dependencies say the check machinery is "consumed, not redesigned." Its AC1 asks for the
eleven roots in `roots` with zero violations, and AC2 asks that an Arabic screen show no English. **Both
cannot hold as the checker stands.** Adding all eleven roots today makes AC1 pass while ~246 literals —
every `.ts` label map, every `emptyMessage`, every `'Active' : 'Inactive'` — render English on an
Arabic screen. AC1 would certify AC2 false.

Resolution: **widen what the checker SEES; change no rule it applies.** The AST walk, the allowlist
format, `runCheck`'s contract, the `npm run i18n:check` wiring, and the test that asserts it all stay
exactly as WIS-11 built them. Three coverage extensions, and one rule that the first of them requires:

- **(a) Scan `.ts` as well as `.tsx`** — `check-no-literals.mjs:62`.
- **(b) Widen `TARGET_ATTRS`** (**:37**) with the prop names verified to carry prose.
- **(c) Walk `ConditionalExpression` and `TemplateExpression`** inside JSX initializers and children,
  instead of stopping at `ts.isStringLiteral` (**:81–89**).
- **(d) One new rule, because (a) does nothing without it.** A `.ts` file contains no JSX, so the two
  existing rules find **literally zero** in one — and the three `model/columns.tsx` files hold their
  headers as object properties, not JSX. So (a) is inert unless the checker can see a **string-valued
  property of an object literal**. That is rule (d), filtered by a prose test (contains a space, two or
  more `\p{L}{2,}` runs, and none of `-` `_` `/` `.` `:` — which matches `'Live chat'` and skips
  `'dt-btn dt-btn-primary fv'`), plus a name-based shortcut for single-word maps: every string-valued
  property of an exported `const` whose identifier matches
  `/(LABELS?|COPY|STRINGS|MESSAGES|OPTIONS|PRESENTATION)$/i`.

  **This is a real addition and is called out as one.** It is the minimum that makes AC1 imply AC2. If
  it is rejected in review, then AC2 must be struck from this story's Done Criteria rather than
  silently certified by AC1.

**Deliberately NOT added** (recorded, not done): a Zod-`message:` rule, and a `no-direct-Intl` rule.
Zod messages are caught incidentally by rule (d) where they are prose; the ~22 in 7 schema files are
migrated by hand in Task 5 either way. `no-direct-Intl` is out of scope per the formatting decision below.

**2 — Label maps become KEY maps; sentence builders take a REQUIRED `t`.**

- A `Record<Enum, string>` of display labels becomes a `Record<Enum, string>` of **i18n keys**; the
  component calls `t(MAP[value])`. Pure data stays pure data, and the key is a static string rule (d)
  can see.
- A function that composes a sentence takes `t` as a **required** parameter — the shape
  `formatDuration` established, but **required, not optional**. An optional `t` is exactly what kept
  `formatDuration.ts:42`'s `value === 1 ? '' : 's'` alive inside a migrated feature. Update call sites
  and tests; do not keep an English default branch "for tests."

**3 — Server `*_label` fields stay authoritative.** `TicketResource` already ships
`priority_label` / `status_label` / `channel_label` resolved through `api/lang/{en,ar}/enums.php`. The
client maps at `tickets/model/display.ts:21–42` are **fallbacks**. They become keys; they do **not**
become the primary source, and no new client-side enum map is introduced. Where an enum's server
`label()` returns raw English, that is **out of scope** — recorded below, not patched on the client.

**4 — Arabic plural keys are mandatory, and the parity test is the gate.**
`catalogueParity.test.ts:47–62` already asserts all six CLDR forms whenever either locale defines
`<base>_one` or `<base>_other`. It is vacuous today. Every count-bearing key extracted in Tasks 2 and 5
ships `_zero`/`_one`/`_two`/`_few`/`_many`/`_other` in `ar` and `_one`/`_other` in `en`.

**5 — Formatting fixes are scoped to the eleven folders and add no enforcement.** The 21 sites in
Tier 3 sit inside the folders being migrated and visibly break AC2 on an Arabic screen, so they are
fixed here by calling the formatters WIS-11 already exports. No `no-direct-Intl` rule is added, and no
audit of the rest of the tree is performed — that is a separate concern.

**6 — The CSAT public page keeps browser detection.** `detectCsatLocale`
(`csatStrings.ts:113–115`) remains the page's locale authority, unchanged. Its strings move into the
`csat` namespace and the page drives i18next with the detected locale.

---

## Implementation tasks

### 1 — Extend the checker's coverage, then fix the fallout in the four current roots

**File: `web/scripts/check-no-literals.mjs`** — apply (a)–(d) from Decision 1. Keep both existing rules,
`isAllowed` (**:39–47**), the allowlist format, and `runCheck`'s return shape (**:119**) unchanged, so
`noHardcodedStrings.test.ts` and `npm run i18n:check` keep working untouched.

**Validate rule (d) before wiring it in.** Run it over all of `web/src`, review every hit, and confirm
each is a real literal or an allowlist entry with a reason. If it proves noisy, narrow its scope to
`src/features/**/model/**` plus the exported-const shortcut — **do not delete it**, or extension (a) is
inert and AC2 is unenforceable.

**File: `web/scripts/i18n-allowlist.json`** — add exemptions **with reasons** for what the new coverage
legitimately catches: the SVG path data at `tickets/model/display.ts:7–13` (`CHANNEL_ICON_PATHS`), and
the channel/category **slug** arrays at `agent-productivity/pages/QuickRepliesPage.tsx:13` and
`components/QuickReplyEditModal.tsx:16` (API values — translate the display, never the value). Nothing
is exempted because fixing it is tedious.

**Then fix what the new coverage exposes inside today's four roots** — the check must be green before
Task 5 begins:

- `web/src/features/sla-rules/model/formatDuration.ts:31–43` — make `t` **required**, delete the
  English fallback at **:42** (Decision 2). Update `SlaRuleCard.tsx`, `DurationField.tsx`, and
  `formatDuration.test.ts`.
- `web/src/features/sla-rules/model/slaRuleSchema.ts:26,30` and `web/src/features/auth/loginSchema.ts`
  — Zod messages to keys. **Both files sit in "guarded" roots and pass today**, which is the clearest
  single proof that the roots array alone gives false confidence.

### 2 — Extend `common` for shared chrome (`src/components`, 13 violations)

**File: `web/src/i18n/locales/{en,ar}/common.json`** — add a `table.*` block beside `actions.*` / `state.*`.

| Site | Key |
|---|---|
| `components/data-table/BulkActionBar.tsx:26,43` | `table.selected` (count-bearing → six `ar` forms), `table.clearSelection` |
| `components/data-table/ColumnMenu.tsx:23,35` | `table.columns`, `table.columnMoved` (interpolates `{{column}}`; the `earlier`/`later` ternary becomes two keys) |
| `components/data-table/DataTable.tsx:89,100` | `table.sortAscending` / `table.sortDescending`, `table.selectAllRows` |
| `components/data-table/DataTableError.tsx:17,21` | reuse `state.errorTitle`, `actions.retry` |
| `components/data-table/DataTableSkeleton.tsx:16` | reuse `state.loading` |
| `components/data-table/Pagination.tsx:30,34,40,69` | `table.showingRange` — **one interpolated sentence**, not three fragments; `table.previousPage`, `table.nextPage` |
| `components/ui/ConfirmDialog.tsx:34`, `Modal.tsx:98` | reuse `actions.cancel`, `actions.close` |

`DataTableEmpty.tsx` and `ConfirmDialog.tsx` take prose as props (`title`, `body`, `confirmLabel`) and
stay presentational — the **callers** translate. That is why coverage extension (b) matters.

Add `src/components` to `roots`.

### 3 — Fix the locale bugs inside the eleven folders

Call the formatters `web/src/i18n` already exports; `formatRelative` (`formatters.ts:62–78`) covers
every relative case, `formatDate` / `formatDateTime` the rest via their `options` parameter.

| Delete / rewrite | Replacement |
|---|---|
| `tickets/model/display.ts:52–92` (`RELATIVE_UNITS`, `formatRelativeTime`, `formatAbsoluteTime`) | `formatRelative`, `formatDateTime` — **delete outright**, they are duplicates |
| `users-roles-admin/model/relativeTime.ts:8,39` (module consts) | `formatRelative`, `formatDateTime` |
| `agent-productivity/model/dueStateLabel.ts:8,9` (module consts) | `formatRelative`, `formatDate` |
| `notifications/model/notificationTime.ts:9` (module const) | `formatDate` |
| `knowledge-base/model/columns.tsx:8`, `customers/model/columns.tsx:8` | `formatDate` |
| `customers/components/InteractionHistory.tsx:5`, `NotesPanel.tsx:4` | `formatDate` |
| `tickets/components/thread/CustomerInfoCard.tsx:8`, `MessageList.tsx:21`, `MessageMeta.tsx:8` | `formatDate` / `formatDateTime` with options |
| `agent-productivity/pages/QuickRepliesPage.tsx:136`, `customers/components/CustomerFormModal.tsx:174` | `formatDate` |
| `channels/components/ChannelCard.tsx:40` (`.toLocaleString()`) | `formatNumber` |
| `reports/model/report.ts:111` (**`'en-US'`**) | `formatDate(iso, { month: 'short', day: 'numeric' })` |
| `reports/components/CsatCard.tsx:25,37` (`.toFixed(2)`) | `formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })` |
| `csat/pages/CsatResponsePage.tsx:21–24` (local `formatDate`, **`'ar-EG'`**) | `formatDateTime` — removes the Eastern-Arabic-numeral defect |

**Every module-level formatter constant must become a per-call construction.** Nine of these are
`const` at module scope, so they bind the locale at import and cannot follow a language switch even
once the locale argument is correct.

### 4 — Fix the 13 naive plural sites

Each becomes `t('<key>', { count: n })` with all six Arabic forms.

| Site | Key |
|---|---|
| `agent-dashboard/pages/AdminDashboardPage.tsx:32` | the generic `count(n, noun)` helper is **deleted** — a helper that pluralizes an arbitrary noun cannot be translated; each caller gets its own key |
| `agent-dashboard/pages/TeamDashboardPage.tsx:29` | `dashboard:team.agents` |
| `tickets/pages/TicketQueuePage.tsx:131` | `tickets:queue.ticketCount` |
| `tickets/components/BulkConfirmDialog.tsx:80,106` | `tickets:bulk.ticketCount`, `tickets:bulk.appliedCount` |
| `tickets/components/thread/TicketMetaPanel.tsx:177` | `conversation:close.openTasksWarning` |
| `knowledge-base/pages/KnowledgeBaseIndexPage.tsx:328` | `knowledge:bulk.confirmCount` |
| `knowledge-base/pages/ArticleReaderPage.tsx:144` | `knowledge:reader.revisionCount` |
| `customers/pages/CustomersPage.tsx:103,106` | `customers:bulk.deleteConfirm`, `customers:bulk.tierConfirm` |
| `reports/components/CsatCard.tsx:29` | `reports:csat.responseCount` |
| `sla-rules/model/formatDuration.ts:42` | deleted in Task 1 |
| `tickets/components/FilterChip.tsx:21`, `customers/components/FacetFilter.tsx:18`, `users-roles-admin/components/FilterChip.tsx:52` | trailing `` `${selected.length} selected` `` → `common:table.selected` from Task 2 |

### 5 — Feature extraction, largest first

For each feature: populate `web/src/i18n/locales/{en,ar}/<ns>.json`, convert components to `useT(ns)`,
convert `model/*` per Decision 2, then **add the root to `roots` and re-run the check**. One feature per
commit — a 396-literal single commit is unreviewable.

1. **`tickets` (52) → `tickets`.** `model/display.ts:21–50` → key maps. `model/columns.ts:28–36` (9
   labels) → keys. `model/newTicketSchema.ts:9–11`, `model/replySchema.ts:7` → Zod keys.
   `components/SlaCell.tsx:36` (three-way ternary) → three keys. `components/FilterBar.tsx:16`,
   `TicketQueueEmpty.tsx:33`, `NewTicketModal.tsx:95,266`, `BulkConfirmDialog.tsx:80,106,108`,
   `pages/TicketDetailPage.tsx:120`.
2. **`tickets/components/thread` (39) → `conversation`.** `ActivityList.tsx:8–20` — seven templated
   event sentences; each becomes **one key with `{{who}}` / `{{value}}` interpolation**, never
   concatenated. `TicketMetaPanel.tsx:18–21,62–65` option lists → keys. `ReplyComposer.tsx:178,235,265`,
   `MessageList.tsx:43,59`, `MessageMeta.tsx:26`, `AssignedAgentCard.tsx:49,90`, `ThreadStates.tsx:61`.
3. **`agent-productivity` (63) → `productivity`.** `model/dueStateLabel.ts:14–44` — the
   `today`/`yesterday`/`tomorrow`/`now` table is exactly what `formatRelative` with `numeric: 'auto'`
   already produces; delete the table and keep only the `Overdue ·` / `Due soon ·` / `Completed ·`
   frames as keys. `model/{quickReply,task}Schema.ts` → Zod keys. `pages/QuickRepliesPage.tsx:194,197`,
   `components/QuickReplyEditModal.tsx:58`, `TicketTasksPanel.tsx:23`.
4. **`customers` (57) → `customers`.** `model/columns.tsx:18–61` (6 headers),
   `model/customerSchema.ts:5,6,15`, `components/AttachmentsPanel.tsx:20,23,146,147`,
   `CustomerFormModal.tsx:105,195,206,207`, `pages/CustomersPage.tsx:33,34,107,108,138–151,198–251`.
5. **`knowledge-base` (48) → `knowledge`.** `model/columns.tsx:27–68` (5 headers),
   `model/articleSchema.ts:13,14,23,24,28`, `pages/KnowledgeBaseIndexPage.tsx:29–31,36–49`
   (`BULK_COPY` → keys), `:243,249,250,253,263,283,309`, `ArticleEditorPage.tsx:168`,
   `ArticleReaderPage.tsx:144`, `components/ArticlePickerPanel.tsx:84`.
6. **`users-roles-admin` (40) → `users`.** `model/adminUser.ts:11–15` → key map.
   `model/relativeTime.ts:13,16,22` (`'Never'`, `'Just now'`) → keys. `model/userSchema.ts:12,16,17`,
   `model/columns.tsx:22–104` (7 headers), `pages/AuditLogPage.tsx:29–65` (5 inline headers),
   `:112–197`, `pages/UsersPage.tsx:27–30,40–42,146–228`, `components/StatusPill.tsx:9`,
   `UserFormModal.tsx:97,145`, `DeactivateUserDialog.tsx:74,102`, `SystemSettingsPage.tsx:180`.
7. **`agent-dashboard` (24) → `dashboard`.** `model/greeting.ts:4` → three keys. The five widgets'
   `title` / `errorMessage` / `emptyMessage` props (`EscalationsWidget.tsx:20,23,24`,
   `MyQueueWidget.tsx:19,22,23`, `QuickRepliesWidget.tsx:19,22,23`, `SlaRiskWidget.tsx:31,32,33`,
   `WorkloadBalanceWidget.tsx:34,37,38`), `DashboardWidget.tsx:48`, `AdminDashboardPage.tsx:45–66`,
   `AgentDashboardPage.tsx:29–42`, `TeamDashboardPage.tsx:39–52`.
8. **`reports` (21) → `reports`.** The five `emptyMessage` props (`AgentPerformanceCard.tsx:16`,
   `ChannelMixCard.tsx:14`, `CsatCard.tsx:21`, `SlaComplianceCard.tsx:16`, `TicketVolumeCard.tsx:22`),
   `TicketVolumeCard.tsx:24` (chart `label`), `model/report.ts:96` (`formatMinutes`).
9. **`notifications` (20) → `notifications`.** JSX chrome plus `model/notificationTime.ts:16`.
10. **`channels` (10) → `channels`.** Almost entirely `model/channel.ts`: `PERIOD_LABELS:39–43`,
    `STATUS_LABELS:54–59`, `CHANNEL_PRESENTATION:73–108` (5 labels + 5 help lines), the fallback at
    **:121**. All become keys; `presentationFor` (**:117**) returns keys and the card calls `t`.
11. **`csat` (9) → `csat`.** See Task 6.

**`'Just now'` is implemented twice** (`notifications/model/notificationTime.ts:16`,
`users-roles-admin/model/relativeTime.ts:22`) and is what `formatRelative` with `numeric: 'auto'`
returns for a sub-minute delta. Delete both; do not create two keys for one string.

### 6 — Absorb the CSAT catalogue, keep browser detection

**File: `web/src/i18n/locales/{en,ar}/csat.json`** — port both halves of `csat/model/csatStrings.ts`
(`en` **:43–74**, `ar` **:76–105**). The Arabic already exists and is good; it **moves**, it is not
re-translated. Function-valued members become interpolated keys: `requestLabel` (**:46**) → `request`
with `{{number}}` / `{{subject}}`; `ratingSelected` (**:51**) → `{{label}}`; `submittedBody`
(**:59**) → `{{number}}`; `submittedOn` (**:64**) → `{{date}}`. `ratingOptions` / `ratingEmojis`
(**:49–50**) become indexed keys `rating.1`…`rating.5` — **arrays are not translatable units**.

**File: `web/src/features/csat/model/csatStrings.ts`** — reduce to `detectCsatLocale` (**:113–115**)
and `csatDir` (**:117–119**), both **unchanged**. Delete `CsatStrings`, `CSAT_STRINGS`, `en`, `ar`.
Update `csatStrings.test.ts` to cover detection only.

**File: `web/src/features/csat/pages/CsatResponsePage.tsx`** — drive i18next with the detected locale
(the page is public and sits outside `UiPreferencesProvider`) via a scoped `I18nextProvider` or
`i18n.getFixedT(detected, 'csat')`. **Do not call `setLocale`** — that would fire
`PATCH /api/user/preferences` (`UiPreferencesContext.tsx:126`) for a user who is not signed in. Delete
the local `formatDate` (**:21–24**) per Task 3.

---

## Found during planning — outside this story

Verified, real, and **not WIS-17**. Preserved so it can be filed rather than rediscovered.

**Backend user-facing English.** Only **6 of 143** PHP files under `api/app` call `__()` / `trans()`,
so an Arabic screen still receives English from the server:

- **7 of 11 enums return raw English from `label()`** — `MessageVisibility.php:13–14`,
  `NotificationType.php:23–26`, `TaskStatus.php:14–16`, `CustomerTier.php:14–16`,
  `ArticleStatus.php:21–23`, `QuickReplyStatus.php:13–14`, and `app/Models/Ticket.php:55–62`
  (`categoryLabel()`). The correct precedent already exists in
  `app/Enums/{Channel,Priority,TicketStatus,UserRole}.php`.
- **All 7 Request `messages()` overrides are unwrapped** — `StoreUserRequest.php:37–38`,
  `UpdateUserRequest.php:41–42`, `StoreCustomerAttachmentRequest.php:30,31,33`,
  `StoreCustomerRequest.php:37,57,75,88`, `UpdateCustomerRequest.php:40,63,83,96`,
  `StoreTicketMessageRequest.php:30`, `IndexAuditLogRequest.php:40`, `UpdateSettingsRequest.php:52`.
  `StoreCustomerRequest.php:88` / `UpdateCustomerRequest.php:96` hand-roll `'The given data was
  invalid.'`, bypassing Laravel's already-translated default.
- **Controllers / middleware / services** — `AuthenticatedSessionController.php:46` (**:35** directly
  above already uses `trans('auth.failed')`), `ActiveUserOnly.php:33`, `CustomerController.php:185–186`
  (`'A customer with this email already exists.'` exists in **three** places and should collapse to one
  key), `TicketController.php:140` (an English frame around already-translated enum labels),
  `UserAdminService.php:128,192`, `MentionResolver.php:39,45,51`, `Kb/ArticleWriter.php:170,174,178`,
  `AuditTrail.php:78–91` (14 audit labels), `SystemSettings.php:34–66` (5 labels + 5 help lines).
- **Persisted notification text freezes its locale at write time** — `SlaNotifier.php:28,39`,
  `TicketMessageController.php:115`, `DispatchDueTaskReminders.php:49–50` write English **into the
  database**, so a user who later switches to Arabic still sees those rows in English. The fix is to
  store a key plus its interpolation payload and translate at render. **Translating at write time is
  not a fix** — it produces permanently mixed-language notification lists.
- `Exceptions/AuditLogIsAppendOnly.php:16` is developer-facing and should stay English.

**Would need:** new `api/lang/{en,ar}/{messages,audit,settings}.php` with full parity, extensions to
`api/tests/Feature/I18n/{CatalogueParityTest,EnumLabelLocaleTest,LocalizedValidationTest}.php`.

**Two smaller items:**

- `web/src/features/csat/api/csatPublicClient.ts:11` is a second Axios instance and **sends no
  `Accept-Language`**, so server validation on the public CSAT endpoints answers in English on an
  Arabic page. A language header is not a credential, so adding one does not weaken the deliberate
  credential-free design documented at **:3–10**. Left out here because its value depends on the
  backend work above.
- A `no-direct-Intl` enforcement rule would stop Task 3's fixes from growing back. Not added, per
  Decision 5.

---

## Edge Cases & Failure Modes

- **The parity test goes from vacuous to binding.** `catalogueParity.test.ts` passes today only because
  12 catalogues are `{}`. The first populated namespace with an `en`-only key fails it. That is
  intended — **fix the catalogue, never relax the test**.
- **Six-form Arabic plurals are easy to half-do.** `catalogueParity.test.ts:47–62` triggers on
  `<base>_one` **or** `<base>_other` in **either** locale, so an `en`-only pair demands all six `ar`
  forms immediately. Write all six when you write the English pair.
- **Sentence fragments cannot be reassembled in Arabic.** `Pagination.tsx:30,34` renders
  `Showing … of …` as three JSX pieces; `ActivityList.tsx:8–20` builds seven sentences by
  concatenation. Each becomes **one key with named interpolation**. Per-fragment extraction passes the
  check and produces word-salad in Arabic — the most likely way to get this story wrong.
- **Module-level `Intl` constants bind the locale at import.** The nine in Tier 3 cannot follow a
  switch even after the locale argument is fixed; they must become **calls**. A test that only switches
  locale and re-renders will still read stale output if this is missed.
- **`ar-EG` reintroduces Eastern Arabic numerals.** `CsatResponsePage.tsx:24` is the live instance.
  `formatters.ts:24` supplies `numberingSystem: 'latn'`. Never pass a locale tag with an implicit
  numbering system.
- **The CSAT page must not write a preference.** It is public with no user; routing it through
  `setLocale` would fire an unauthenticated `PATCH`.
- **Zod messages inside "guarded" roots pass today.** `auth/loginSchema.ts` and
  `sla-rules/model/slaRuleSchema.ts:26,30` are in enforced roots and invisible. Treat any "this root is
  already done" claim as unverified until rule (d) lands.
- **`slaRuleSchema.ts:26,30` are deliberately byte-identical to the server's messages** (docblock
  **:5–9**). When they move to a catalogue the **English must stay byte-identical**; the Arabic side has
  no server counterpart yet (that is in the out-of-scope section), so record the mismatch rather than
  inventing a server key here.
- **Category slugs are API values.** `['billing','account','technical','general']`
  (`QuickRepliesPage.tsx:13`, `QuickReplyEditModal.tsx:16`) are sent to the server — translate the
  display, never the value; allowlist the arrays.
- **Genuine uncertainty — the false-positive rate of rule (d).** The heuristic was designed against the
  literals inventoried here, not proven across the whole tree. Validate it as Task 1 specifies. If it
  is narrowed to nothing, AC2 is unenforceable and must be struck rather than silently certified.
- **Genuine uncertainty — whether the `conversation` split survives review.** The intake names
  `src/features/tickets` once; this plan funds two namespaces from it. If review prefers one, the
  thread's 39 literals go to `tickets` and the `conversation` catalogue stays empty — decide before
  Task 5.2, not during.
- **Backend baseline.** ~10 `Customer*` Pest tests fail on `main`. No backend source changes here, so
  the count must be identical afterwards.

---

## Test Plan

1. **`web/src/i18n/noHardcodedStrings.test.ts`** — extend the fixture assertions (**:22–28**) to cover
   each coverage extension: a `.ts` label map, a non-`TARGET_ATTRS` prose prop, a ternary in a JSX
   expression, and a template literal. Add fixtures beside
   `web/src/i18n/__fixtures__/BareLiteral.fixture.tsx`. **The `runCheck()` assertion at `:12–20` is the
   story's gate** — as roots are added it must stay green. This test is AC1.
2. **`web/src/i18n/catalogueParity.test.ts`** — unchanged; it becomes meaningful automatically. Add one
   case: **no `ar` value is byte-identical to its `en` counterpart**, with a documented exemption list
   for values that legitimately match (`'Wisal'`, `'SMS'`). This catches copy-paste stubs, which is
   the most likely way AC2 gets falsely certified.
3. **Per-feature Arabic render tests** — for each of the eleven roots, one test that renders its main
   screen under `ar` and asserts a known Arabic string appears and a known English one does not.
   Match `web/src/features/sla-rules/pages/SlaRulesPage.test.tsx`. **This is AC2**; the check alone
   cannot prove it.
4. **`web/src/features/tickets/components/thread/ActivityList.test.tsx`** — the seven event sentences
   render as whole sentences in `ar` with interpolated values in the right position.
5. **Plural tests** — one parameterised test over the 13 keys from Task 4, asserting the `ar` output at
   counts 0, 1, 2, 3, 11, 100 differs across the six categories.
6. **`web/src/i18n/formatters.test.ts`** — add a case asserting a converted component re-renders with
   an Arabic-formatted, **Latin-digit** date after `i18n.changeLanguage('ar')`. This is what would have
   caught the module-level-constant bug.
7. **`web/src/features/csat/model/csatStrings.test.ts`** — reduced to `detectCsatLocale` / `csatDir`.
   **Behaviour must not change** — that is Story 13's contract.
8. **`web/src/features/csat/pages/CsatResponsePage.test.tsx`** — with `navigator.language = 'ar-SA'` the
   page renders Arabic **without** any `PATCH /api/user/preferences`, and the date renders with Latin digits.
9. **Regression** — all 424 existing tests pass. Any test asserting an English literal that has moved to
   a catalogue asserts the rendered value instead.
10. **Backend regression** — `cd api && php artisan test`. No backend source changes, so the `Customer*`
    failure count must be identical to baseline.

---

## Verification Steps

1. **Coverage extension lands first:** `cd web && node scripts/check-no-literals.mjs` — green over the
   four original roots **under the extended coverage**, before any new root is added.
2. **Rule (d) dry run:** `cd web && node scripts/check-no-literals.mjs src` — review every hit; each is
   a real literal or an allowlist entry with a reason. Record the count in the PR.
3. **AC1 — all eleven roots enforced:** `web/scripts/i18n-allowlist.json` `roots` contains all four
   original plus the eleven pending roots, the `_rootsNote` at **line 9** is **deleted**, and
   `cd web && npm run i18n:check` exits 0.
4. **AC3 — every exemption justified:** every entry in `literals` / `patterns` has a `reason`.
5. **No empty catalogues:** every file under `web/src/i18n/locales/{en,ar}/` is larger than 3 bytes.
6. **No naive plurals:** `grep -rn "=== 1 ?" web/src --include=*.ts --include=*.tsx` → hits only in
   non-linguistic contexts (`DataTable.tsx:141`, `TicketTable.tsx:52` zebra striping).
7. **No stale locale in migrated folders:**
   `grep -rn "Intl\.\|toLocaleString\|toLocaleDateString\|toLocaleTimeString" web/src --include=*.ts --include=*.tsx | grep -v "^web/src/i18n/"`
   → zero hits outside tests, and `grep -rn "en-US\|ar-EG" web/src` → zero hits.
8. **Frontend builds, lints, tests:** `cd web && npm run build && npm run lint && npx vitest run` —
   all green; test count ≥ 424 plus the new suites.
9. **Backend unchanged:** `cd api && php artisan test` — `Customer*` failure count equal to baseline.
10. **AC2, manual, both locales:** `php artisan serve` + `npm run dev`. Switch to **AR** and walk every
    migrated screen: tickets queue, ticket detail + thread, customers, knowledge base, users, audit log,
    settings, dashboards, reports, channels, notifications. No English survives; dates and numbers use
    **Latin digits**; plurals read correctly at 1/2/3/11; ticket numbers, emails, and URLs stay LTR.
    **Server-sent validation messages will still be English** — that is the out-of-scope backend gap,
    and it must be recorded in the PR so it is not mistaken for a miss here.
11. **AC2, public CSAT:** open a survey link with the browser set to Arabic — the page is Arabic, no
    `PATCH /user/preferences` fires, and the date shows Latin digits.

---

## Done Criteria

Mapped to the intake's three acceptance criteria, refined per its "draft — refine during planning" note.

**AC1 — the check covers all eleven roots and passes:**

- [ ] All eleven pending roots are in `web/scripts/i18n-allowlist.json` `roots`, and the `_rootsNote` pending list at line 9 is deleted.
- [ ] `npm run i18n:check` and `npx vitest run` both exit 0 with zero unlisted-literal violations.
- [ ] The checker's **coverage** is extended — `.ts` scanned, prose-carrying props added, ternary and template initializers walked, and the object-literal-property rule that makes `.ts` scanning meaningful — while its **mechanism** (AST walk, allowlist format, `runCheck` contract, `npm` wiring, the asserting test) is unchanged, each extension proven by a fixture.

**AC2 — an Arabic screen shows no English:**

- [ ] All 12 empty feature catalogues are populated in **both** locales; no catalogue file is `{}`.
- [ ] Each of the eleven roots has a test that renders its main screen under `ar` and asserts Arabic present / English absent — AC2 is proven by test, not by the check passing.
- [x] Composed sentences (`Pagination`'s "Showing … of …", the seven `ActivityList` events) are **single interpolated keys**, not concatenated fragments.
- [ ] All 13 naive plural sites use `t(key, { count })`; every count-bearing key carries all six Arabic CLDR forms, proven by `catalogueParity.test.ts`.
- [ ] No `ar` value is a byte-identical copy of its `en` counterpart outside the documented exemptions.
- [ ] Inside the eleven folders: zero `Intl` / `toLocale*` calls outside `web/src/i18n/`, no module-level formatter constants, and no `'en-US'` or `'ar-EG'` — so dates and numbers follow the app locale and render Latin digits.
- [ ] `csat/model/csatStrings.ts` is reduced to `detectCsatLocale` + `csatDir`, both behaviourally unchanged; the page renders Arabic from browser detection **without** issuing `PATCH /api/user/preferences`.

**AC3 — exemptions are justified:**

- [ ] Every `literals` / `patterns` entry carries a reason; nothing was exempted because fixing it was tedious; the SVG path data and API slug arrays are listed explicitly.

**Scope integrity:**

- [ ] No file under `api/` is modified. The backend English inventory is filed as its own tracker item, and the PR states plainly that Arabic screens still receive English server messages until it lands.
- [x] Story 15's plan file is left **unmodified** — it is read-only history.
- [x] `00-overview.md` and `00-index.md` updated with this story.
