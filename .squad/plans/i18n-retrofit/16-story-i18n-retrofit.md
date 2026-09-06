# Story 16 — i18n String Extraction Retrofit: Complete WIS-11 Coverage (Story: WIS-17)

> **Replan, 2026-09-06.** The first cut of this plan covered eleven pending roots. Two of them
> — `src/components` (via `common`) and `src/features/tickets` (via `tickets` + `conversation`) —
> and the whole of the checker-coverage work have since shipped. **This plan is scoped to what
> is actually left: the nine remaining roots.** Every number below was re-measured against the
> working tree on 2026-09-06, not carried over.

---

## Prerequisites

- **Story 15 (WIS-11) completed** — [`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md).
  It shipped i18next, `useT`, the four `Intl` formatters, `UiPreferencesContext.locale`, the
  `Accept-Language` interceptor, the Arabic font stack, `SetLocale`, `users.locale`, and
  `web/scripts/check-no-literals.mjs`. This story **consumes** that machinery and redesigns none of it.
- **The checker-coverage extension is already landed.** `check-no-literals.mjs` (348 lines) now scans
  `.ts` as well as `.tsx`, carries an 18-entry `TARGET_ATTRS` set (**:36–55**), and emits four violation
  kinds — `jsx-text`, `attr:<name>`, `object-literal`, `zod-message`. Decision 1(a)–(d) of the original
  plan is **done**; do not redo it.
- **Two roots are already migrated and must not be re-planned or re-touched:** `src/components`
  (folded into `common`) and `src/features/tickets` (into `tickets`, with `components/thread/` in
  `conversation`). `node scripts/check-no-literals.mjs` passes today over **171 files / 10 roots**.
- **Coordinate with nothing.** Stories 17–20 (`portal`, `integrations`, `ai-assist`, `organization`)
  each added their own root and shipped compliant. This story never has to retrofit them.

---

## Story Goal

Move every remaining hard-coded user-facing literal out of nine feature folders and into the
translation catalogues WIS-11 established, then add each folder to
`web/scripts/i18n-allowlist.json`'s `roots` array — **the array is the acceptance signal, and a root
joins it only when its literals are gone.**

At the end of this story:

1. `roots` holds **19** entries — the 10 that pass today plus the nine below — and
   `node scripts/check-no-literals.mjs` exits `0` over all of them.
2. `_rootsNote`'s "Pending:" sentence is **deleted**, because nothing is pending.
3. Nine catalogue pairs that ship as empty `{}` today (`customers`, `knowledge`, `notifications`,
   `reports`, `users`, `dashboard`, `productivity`, `channels`, `csat` — in both `en` and `ar`) are
   populated, and `catalogueParity.test.ts` passes against them.
4. Every `Intl` / `toLocale*` call inside those nine folders is replaced by a `web/src/i18n` formatter,
   so a language switch actually changes the rendered date, number, and relative time.
5. Every naive `n === 1 ? … : …` pluralization inside those nine folders becomes a
   `t(key, { count })` with all six Arabic CLDR forms.

**Not in scope:** new translatable copy; non-text RTL/layout defects (WIS-11's surface); the backend
(**no file under `api/` is modified** — see *Found during planning*); and the two roots already shipped.

---

## Context — Read These Files First

1. `web/scripts/i18n-allowlist.json` — the whole file (44 lines). The `roots` array (**:3–14**) is what
   this story grows; `_rootsNote` (**:15**) names the nine pending folders and is deleted at the end.
   Note the three existing `patterns` — in particular the dotted-key pattern
   `^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9_]+)+$`, added by this story's first pass so a **key map**
   (a `Record<Enum, string>` holding `'priority.low'`) does not itself trip the checker.
2. `web/scripts/check-no-literals.mjs` — read `TARGET_ATTRS` (**:36–55**) and the four violation kinds.
   **Read only; this story changes no rule.** Run it per-folder with an explicit path argument
   (`node scripts/check-no-literals.mjs src/features/customers`) to see a folder's violations before
   the root is added.
3. `web/src/i18n/index.ts` — the entire public surface (49 lines). `useT(ns)` (**:26–29**) pins a
   namespace and keeps `common` reachable as fallback; `formatDate` / `formatDateTime` /
   `formatRelative` / `formatNumber` are re-exported at **:14**. **Components import from
   `web/src/i18n` and nowhere deeper.**
4. `web/src/i18n/formatters.ts` — the four signatures at **:26**, **:38**, **:62**, **:80**.
   `formatRelative(value, now?)` already produces `just now` / `yesterday` / `in 3 days` via
   `numeric: 'auto'`; several folders below hand-roll exactly this and their tables get deleted.
5. `web/src/i18n/instance.ts` — `NAMESPACES` (**:42–60**, 17 entries). All nine namespaces this story
   fills **already exist and are already registered**; you are populating files, not adding namespaces.
6. `web/src/features/sla-rules/` — **the reference implementation.** Read
   `model/formatDuration.ts` and `model/formatDuration.test.ts` together: the sentence-composing
   function takes `t` as a parameter and the test drives it with
   `i18n.getFixedT('en', 'sla')`. Every `model/*.ts` conversion below follows this exact shape.
   Grep for `useT(` across `src/features/sla-rules/` for the six component call sites.
7. `web/src/i18n/locales/en/common.json` and `.../ar/common.json` — already populated. Reuse
   `actions.*`, `state.*`, and the `table.*` block (`table.selected_one` / `table.selected_other`,
   `table.clearSelection`, `table.loadError`, …) rather than re-keying them per feature.
8. `web/src/i18n/locales/ar/tickets.json` — the **plural precedent**. Grep for `_zero` to see the six
   CLDR forms every count-bearing Arabic key must ship.
9. `web/src/i18n/catalogueParity.test.ts` — the gate. `collapsePlurals` (**:24–26**) and
   `AR_PLURAL_SUFFIXES` (**:22**) are why an Arabic count key missing `_two` / `_few` / `_many` fails CI.

---

## Measured scope (verified 2026-09-06 by running the checker per folder)

**488 violations across 165 non-test files in nine roots.** Migrate largest-first; one folder per commit.

| Root | `jsx-text` | `attr:*` | `object-literal` | `zod-message` | Total | Namespace |
|---|---|---|---|---|---|---|
| `src/features/customers` | 49 | 32 | 6 | 2 | **89** | `customers` |
| `src/features/users-roles-admin` | 45 | 26 | 9 | 3 | **83** | `users` |
| `src/features/agent-productivity` | 60 | 12 | 0 | 4 | **76** | `productivity` |
| `src/features/knowledge-base` | 46 | 16 | 8 | 4 | **74** | `knowledge` |
| `src/features/agent-dashboard` | 21 | 28 | 0 | 0 | **49** | `dashboard` |
| `src/features/csat` | 9 | 2 | 29 | 0 | **40** | `csat` |
| `src/features/reports` | 14 | 13 | 3 | 0 | **30** | `reports` |
| `src/features/channels` | 10 | 2 | 15 | 0 | **27** | `channels` |
| `src/features/notifications` | 18 | 2 | 0 | 0 | **20** | `notifications` |

**17 locale-broken formatting sites** and **8 naive plural sites** sit inside these folders; both
lists are enumerated in Tasks 1 and 2 and are fixed as part of their owning folder's commit.

---

## Decisions this story makes explicitly

**1 — Label maps become KEY maps; sentence builders take a REQUIRED `t`.**
A `Record<Enum, string>` of display labels becomes a `Record<Enum, string>` of **i18n keys**, and the
component calls `t(MAP[value])`. Pure data stays pure data, and a static dotted key is exempted by the
allowlist pattern already in place. A function that composes a sentence takes `t` as a **required**
parameter — the shape `formatDuration(minutes, t)` established. **Required, not optional:** an optional
`t` is exactly what kept an English default branch alive inside an already-migrated feature. Update
call sites and tests; do **not** keep an English fallback branch "for tests" — tests use
`i18n.getFixedT('en', ns)`, as `formatDuration.test.ts` already does.

**2 — Server `*_label` fields stay authoritative.** Client-side enum maps are **fallbacks** that become
keys. They do not become the primary source, and no new client-side enum map is introduced. Where an
enum's server `label()` returns raw English, that is **out of scope** — recorded below, not patched on
the client.

**3 — Arabic plural keys are mandatory, and `catalogueParity.test.ts` is the gate.** Every
count-bearing key ships `_zero` / `_one` / `_two` / `_few` / `_many` / `_other` in `ar` and
`_one` / `_other` in `en`.

**4 — Formatting fixes are scoped to these nine folders and add no enforcement.** The 17 sites break
AC2 visibly on an Arabic screen, so they are fixed here by calling the formatters WIS-11 exports. **No
`no-direct-Intl` checker rule is added**, and no audit of the rest of the tree is performed.

**5 — The CSAT public page keeps browser detection.** `detectCsatLocale`
(`csat/model/csatStrings.ts:113–115`) remains the page's locale authority, **behaviourally unchanged**.
Its strings move into the `csat` namespace; the page drives i18next with the detected locale and
**never calls `setLocale`** — the page is public and has no signed-in user to persist a preference for.

**6 — No new namespaces, no new allowlist rules expected.** All nine namespaces are registered in
`instance.ts:42–60`. If migration turns up a genuinely non-translatable token (an icon glyph, an ISO
code), add it to `literals` **with a reason** — per the intake's third acceptance criterion. Do not
add a root to `roots` to silence a violation you have not actually migrated.

---

## Implementation tasks

### 1 — Fix the 17 locale-broken formatting sites

Every one of these binds or hard-codes a locale, so an Arabic screen renders English-formatted dates
and numbers. Nine are **module-level `const`s**, which bind at import and cannot follow a language
switch even once the locale argument is correct — **each must become a per-call construction** through
the shared formatters.

| File | Line(s) | Defect | Replacement |
|---|---|---|---|
| `customers/components/InteractionHistory.tsx` | 5 | module `Intl.DateTimeFormat(undefined, …)` | `formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' })` |
| `customers/components/NotesPanel.tsx` | 4 | module `Intl.DateTimeFormat` | `formatDate` with the same options |
| `customers/model/columns.tsx` | 8 | module `Intl.DateTimeFormat` | `formatDate` |
| `customers/components/CustomerFormModal.tsx` | 174 | `.toLocaleDateString()` | `formatDate` |
| `knowledge-base/model/columns.tsx` | 8 | module `Intl.DateTimeFormat` | `formatDate` |
| `notifications/model/notificationTime.ts` | 9 | module `Intl.DateTimeFormat` | `formatDate(iso, { day: 'numeric', month: 'short' })` |
| `reports/model/report.ts` | 111 | **hard-coded `'en-US'`** | `formatDate(iso, { month: 'short', day: 'numeric' })` |
| `users-roles-admin/model/relativeTime.ts` | 8 | module `Intl.RelativeTimeFormat` | `formatRelative` |
| `users-roles-admin/model/relativeTime.ts` | 39 | module `Intl.DateTimeFormat` | `formatDateTime` |
| `agent-productivity/model/dueStateLabel.ts` | 8 | module `Intl.DateTimeFormat` | `formatDate` |
| `agent-productivity/model/dueStateLabel.ts` | 9 | module `Intl.RelativeTimeFormat` | `formatRelative` |
| `agent-productivity/pages/QuickRepliesPage.tsx` | 136 | `.toLocaleDateString()` | `formatDate` |
| `channels/components/ChannelCard.tsx` | 40 | `.toLocaleString()` on a number | `formatNumber` |
| `csat/pages/CsatResponsePage.tsx` | 21–28 | local `formatDate` with **`'ar-EG'`** | `formatDateTime` — removes the Eastern-Arabic-numeral defect (WIS-11 pinned Latin digits, `numberingSystem: 'latn'`) |

**Delete, do not rewrite:**

- `users-roles-admin/model/relativeTime.ts` (53 lines) — `formatLastActive` (**:10**) and
  `formatTimestamp` (**:48**) are `formatRelative` and `formatDateTime` with extra steps. Keep only
  the `'Never'` branch, as a `users:` key.
- `agent-productivity/model/dueStateLabel.ts` (53 lines) — the `today` / `yesterday` / `tomorrow` /
  `now` table inside `dueStateLabel` (**:26**) is exactly what `formatRelative` with `numeric: 'auto'`
  already produces. Delete the table; keep only the `Overdue ·` / `Due soon ·` / `Completed ·` frames
  as `productivity:` keys, and give the function a required `t`.
- **`'Just now'` is implemented twice** — `notifications/model/notificationTime.ts:11` and
  `users-roles-admin/model/relativeTime.ts:10`. Both are `formatRelative`'s sub-minute output.
  Delete both; do **not** create two keys for one string.

### 2 — Fix the 8 naive plural sites

Each becomes `t('<key>', { count: n })` with all six Arabic forms in `ar`.

| Site | Line | Key |
|---|---|---|
| `customers/components/FacetFilter.tsx` | 18 | `common:table.selected` — **already exists**, do not re-key |
| `customers/pages/CustomersPage.tsx` | 103 | `customers:bulk.deleteConfirm` |
| `knowledge-base/pages/ArticleReaderPage.tsx` | 144 | `knowledge:reader.revisionCount` |
| `knowledge-base/pages/KnowledgeBaseIndexPage.tsx` | 328 | `knowledge:bulk.confirmCount` |
| `reports/components/CsatCard.tsx` | 29 | `reports:csat.responseCount` |
| `users-roles-admin/components/FilterChip.tsx` | 52 | `common:table.selected` — **already exists** |
| `agent-dashboard/pages/AdminDashboardPage.tsx` | 32 | the generic `count(n, noun)` helper is **deleted** — a helper that pluralizes an arbitrary noun cannot be translated. Each caller gets its own key. |
| `agent-dashboard/pages/TeamDashboardPage.tsx` | 29 | `dashboard:team.agents` |

### 3 — Feature extraction, largest first

For each folder: populate `web/src/i18n/locales/{en,ar}/<ns>.json`, convert components to `useT(ns)`,
convert `model/*` per Decision 1, then **add the root to `roots` and re-run the check**.
**One folder per commit** — 488 literals in one commit is unreviewable.

#### 3.1 `customers` (89) → `customers`

`model/columns.tsx` (6 headers as object-literal properties) → key map. `model/customerSchema.ts`
(2 `zod-message`) → Zod keys via required `t`. `components/AttachmentsPanel.tsx` (**:74–147** — 12
violations including `attr:body` and `attr:confirmLabel` on the remove-confirm dialog),
`CustomerFormModal.tsx` (**:105–207** — the `Edit Customer` / `Add Customer` title ternary at **:105**
is two keys, not one), `InteractionHistory.tsx`, `NotesPanel.tsx`, `FacetFilter.tsx`,
`pages/CustomersPage.tsx`.

#### 3.2 `users-roles-admin` (83) → `users`

`model/adminUser.ts` role/status maps → key map. `model/userSchema.ts` (3 `zod-message`) → Zod keys.
`model/columns.tsx` (7 headers) → keys. `model/relativeTime.ts` → deleted per Task 1, leaving only a
`'Never'` key. `pages/AuditLogPage.tsx`, `pages/UsersPage.tsx`, `pages/SystemSettingsPage.tsx`,
`components/StatusPill.tsx`, `UserFormModal.tsx`, `DeactivateUserDialog.tsx`, `FilterChip.tsx`.

#### 3.3 `agent-productivity` (76) → `productivity`

Largest `jsx-text` count of any folder (60). `model/dueStateLabel.ts` reduced per Task 1.
`model/quickReplySchema.ts` and `model/taskSchema.ts` (4 `zod-message`) → Zod keys.
`pages/QuickRepliesPage.tsx`, `components/QuickReplyEditModal.tsx`, `TicketTasksPanel.tsx`.

#### 3.4 `knowledge-base` (74) → `knowledge`

`model/columns.tsx` (5 headers, 8 `object-literal`) → keys. `model/articleSchema.ts` (4 `zod-message`)
→ Zod keys. `pages/KnowledgeBaseIndexPage.tsx` — the `BULK_COPY` map becomes keys, and the
`${verb} ${n} article(s)?` template at **:328** becomes one interpolated plural key per verb, **never
concatenated**. `ArticleEditorPage.tsx`, `ArticleReaderPage.tsx` (**:144**),
`components/ArticlePickerPanel.tsx`.

#### 3.5 `agent-dashboard` (49) → `dashboard`

28 of the 49 are `attr:*` — the five widgets' `title` / `errorMessage` / `emptyMessage` props, which
the shared `DashboardWidget` takes as prose (per the `src/components` decision: the **caller**
translates). `model/greeting.ts` (7 lines, `greeting()` at **:2**) → three time-of-day keys with a
required `t`. `pages/AdminDashboardPage.tsx` (delete the `count` helper, **:32**),
`AgentDashboardPage.tsx`, `TeamDashboardPage.tsx` (**:29**).

#### 3.6 `csat` (40) → `csat` — absorb the catalogue, keep browser detection

**File: `web/src/i18n/locales/{en,ar}/csat.json`** — port both halves of
`csat/model/csatStrings.ts` (the `en` object at **:43**, the `ar` object below it). **The Arabic
already exists and is good; it moves, it is not re-translated.** Function-valued members become
interpolated keys: `requestLabel` (**:15**) → `request` with `{{number}}` / `{{subject}}`;
`ratingSelected` (**:20**) → `{{label}}`; `submittedBody` (**:28**) → `{{number}}`; `submittedOn`
(**:32**) → `{{date}}`. `ratingOptions` / `ratingEmojis` (**:18–19**) become indexed keys
`rating.1`…`rating.5` — **arrays are not translatable units**, and the 29 `object-literal` violations
in this folder are almost entirely these two arrays plus the two string objects.

**File: `web/src/features/csat/model/csatStrings.ts`** (123 lines) — reduce to `detectCsatLocale`
(**:113–115**) and `csatDir` (**:117–119**), both **unchanged**. Delete `CsatStrings`, `CSAT_STRINGS`,
`en`, `ar`. Update `csatStrings.test.ts` to cover detection only.

**File: `web/src/features/csat/pages/CsatResponsePage.tsx`** — the page sits **outside**
`UiPreferencesProvider`, so drive i18next with the detected locale via a scoped `I18nextProvider`
(re-exported from `web/src/i18n/index.ts:13`) or `i18n.getFixedT(detected, 'csat')`. Replace the
`CSAT_STRINGS` import at **:6–11**. Delete the local `formatDate` (**:21–28**) per Task 1.
**Do not call `setLocale`** — it would fire `PATCH /api/user/preferences` for a user who is not signed in.

#### 3.7 `reports` (30) → `reports`

The five cards' `emptyMessage` props (`AgentPerformanceCard.tsx`, `ChannelMixCard.tsx`, `CsatCard.tsx`,
`SlaComplianceCard.tsx`, `TicketVolumeCard.tsx`) plus the chart `label`. `model/report.ts` — the
`'en-US'` bug at **:111** per Task 1, and `formatMinutes` gets a required `t`. `CsatCard.tsx:29` per
Task 2; the `.toFixed(2)` sites in `CsatCard.tsx` →
`formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.

#### 3.8 `channels` (27) → `channels`

15 of 27 are `object-literal`, almost entirely in `model/channel.ts` (126 lines): `PERIOD_LABELS`
(**:39–43**), `STATUS_LABELS` (**:54–57**), and `CHANNEL_PRESENTATION` (**:73–**, 5 `label` + 5
`helpLine` entries). All become keys; `statusLabel` (**:58**) and `presentationFor` return **keys**,
and `components/ChannelCard.tsx` calls `t` on them. `ChannelCard.tsx:40` per Task 1.

#### 3.9 `notifications` (20) → `notifications`

The smallest folder and entirely JSX chrome (18 `jsx-text`, 2 `attr:*`), plus
`model/notificationTime.ts` reduced per Task 1.

### 4 — Close the allowlist

**File: `web/scripts/i18n-allowlist.json`** — with all nine folders migrated, `roots` holds 19 entries.
**Delete the "Pending: …" sentence from `_rootsNote`** and reword the note to say the retrofit is
complete. Any new `literals` entry added during migration must carry a `reason` — per the intake's
third acceptance criterion, a non-translatable token is *documented*, not silently left unlisted.

---

## Edge Cases & Failure Modes

- **A root added to `roots` before its literals move.** The check goes red for everyone, not just the
  author. Enforced by ordering: migrate, run `node scripts/check-no-literals.mjs src/features/<f>`
  until it exits `0`, *then* add the root, in the same commit.
- **An Arabic count key missing a CLDR form.** `catalogueParity.test.ts` (**:22–26**) fails the build.
  This is the intended gate — do not weaken it by dropping `_two` / `_few` / `_many`.
- **A key present in `en` and absent in `ar`.** `missingKey.test.ts` asserts i18next falls back to the
  English value **and** logs the miss via `getMissingKeyCount()`. An Arabic screen showing English is
  therefore a quiet failure that only the counter catches — run the Arabic sweep in Verification.
- **A module-level formatter left in place.** It binds the locale at import, so the first render after
  a language switch is correct only by accident. Grep for `new Intl.` and `toLocale` across the nine
  folders after Task 1; the result must be empty.
- **A composed key.** `t('customers.' + kind)` is invisible to the checker and to any extraction tool.
  Keys are static strings; a variable selects a **whole key** from a map, never a fragment.
- **`ratingOptions` / `ratingEmojis` ported as JSON arrays.** i18next will resolve `t('rating')` to
  `[object Object]`. They must be indexed keys `rating.1`…`rating.5`.
- **The CSAT page writing a user preference.** If the page is wired through `setLocale` instead of a
  scoped provider, an anonymous survey respondent fires `PATCH /api/user/preferences` and 401s. The
  test at `CsatResponsePage.test.tsx` must assert no preference write.
- **Zod schemas evaluated at module scope.** A schema built once at import with `t` captured freezes
  its messages in the import-time language. Build the schema inside the component/hook, or pass `t`
  at validation time.
- **`'Just now'` de-duplicated to one key.** If both call sites are migrated independently, two keys
  for one string ship and drift. Delete both implementations in the same commit.
- **A `.ts` label map whose values are prose, not keys.** The `object-literal` rule flags it; the fix
  is a key map (Decision 1), not an allowlist entry.

---

## Test Plan

1. **`web/src/i18n/catalogueParity.test.ts`** *(existing, unit)* — no edit required; it iterates
   `NAMESPACES` and becomes non-vacuous as the nine catalogues fill. Must stay green after every folder.
2. **`web/src/i18n/noHardcodedStrings.test.ts`** *(existing, unit)* — asserts `runCheck()` over
   `config.roots`. Grows from 10 to 19 roots implicitly. **Do not** pass an explicit root list to
   weaken it.
3. **`web/src/features/csat/model/csatStrings.test.ts`** *(modify, unit)* — strip the `CSAT_STRINGS`
   assertions; keep and extend `detectCsatLocale` coverage (`ar`, `ar-EG`, `en`, `en-GB`, `undefined`).
4. **`web/src/features/csat/pages/CsatResponsePage.test.tsx`** *(modify, integration)* — render under
   a scoped provider with `navigator.language = 'ar'`; assert Arabic copy renders, dates use **Latin
   digits**, and **no `PATCH /api/user/preferences` request is issued**.
5. **`web/src/features/users-roles-admin/model/relativeTime.test.ts`** and
   **`web/src/features/agent-productivity/model/dueStateLabel.test.ts`** *(modify or delete, unit)* —
   whatever survives Task 1's deletions is driven with `i18n.getFixedT('en', ns)`, matching
   `sla-rules/model/formatDuration.test.ts`. Delete tests for deleted functions rather than keeping
   them alive against a shim.
6. **New per-namespace smoke test**, one per migrated folder, following the `formatDuration.test.ts`
   shape: assert the folder's key-map values resolve to non-empty strings in **both** `en` and `ar`
   via `i18n.getFixedT(locale, ns)` — this catches a key map pointing at a key nobody added.
7. **Existing feature tests across the nine folders** *(regression)* — many assert on English strings
   via `getByText('…')`. They must keep passing under the default `en` locale; where a string moved,
   update the assertion to the catalogue value, **not** to a `t()` call inside the test.

---

## Verification Steps

1. **Per folder, before adding its root:**
   `cd web && node scripts/check-no-literals.mjs src/features/<folder>` → exits `0`.
2. **Backend builds:** unchanged — this story touches no PHP. See step 8.
3. **After each folder's commit:** `cd web && npm run i18n:check` → reports a growing root count and
   exits `0`.
4. **Frontend runs:** `cd web && npx vitest run` → green, including `catalogueParity`, `missingKey`,
   and `noHardcodedStrings`.
5. **Frontend builds:** `cd web && npm run build` (`tsc -b && vite build`) → no type errors from the
   `t`-parameter signature changes in `model/*`.
6. **Lint:** `cd web && npm run lint` (`oxlint && npm run i18n:check`).
7. **No stray formatters:**
   `cd web && grep -rn "new Intl\.\|toLocaleDate\|toLocaleTime\|toLocaleString" src/features/{customers,knowledge-base,notifications,reports,users-roles-admin,agent-dashboard,agent-productivity,channels,csat} --include=*.ts --include=*.tsx | grep -v test`
   → **no output**.
8. **Regression:** `cd api && ./vendor/bin/phpunit` → still 419/419. This story modifies no PHP; run it
   to prove that.
9. **Arabic sweep (manual — this is AC2):** `cd web && npm run dev`, switch the header language to
   العربية, and walk every screen in the nine folders — Customers, Users, Audit Log, System Settings,
   Quick Replies, Tasks, Knowledge Base index/reader/editor, all three dashboards, Reports, Channels,
   Notifications, and the public CSAT page (with `navigator.language` forced to `ar`). **No English
   string may render**, and the browser console must log **no missing-key warnings**.

---

## Done Criteria

- [ ] All nine roots — `customers`, `knowledge-base`, `notifications`, `reports`, `users-roles-admin`, `agent-dashboard`, `agent-productivity`, `channels`, `csat` — are present in `web/scripts/i18n-allowlist.json`'s `roots`, bringing it to **19** entries.
- [ ] `npm run i18n:check` exits `0` with **zero** unlisted-literal violations across all 19 roots.
- [ ] The `Pending: …` sentence is **deleted** from `_rootsNote`.
- [ ] All 18 catalogue files under `web/src/i18n/locales/{en,ar}/` are populated; **none** still ships as `{}`.
- [ ] Every new `literals` / `patterns` entry added during migration carries a `reason`.
- [ ] `grep` for `new Intl.` / `toLocale*` across the nine folders returns nothing (17 sites fixed).
- [ ] All 8 naive plural sites use `t(key, { count })`; every count-bearing `ar` key ships all six CLDR forms.
- [ ] `'Just now'` exists as exactly one key; `relativeTime.ts` and `dueStateLabel.ts` no longer hand-roll relative time.
- [ ] `csatStrings.ts` contains only `detectCsatLocale` and `csatDir`, both behaviourally unchanged; the CSAT page issues **no** preference write.
- [ ] `npx vitest run` and `npm run build` are green; `catalogueParity.test.ts` is no longer vacuous.
- [ ] Manual Arabic sweep of all nine folders shows no English text and no missing-key console warnings.
- [ ] **No file under `api/` is modified**, and the PR states that Arabic screens still receive English server messages from the enums and services listed below until that work is filed and landed.

---

## Found during planning — outside this story

Verified, real, and **not WIS-17**. Recorded so it can be filed rather than rediscovered.

- **The backend is largely unlocalised.** Only a small minority of PHP files under `api/app` call
  `__()`. Several services return raw English that reaches an Arabic screen, and persisted
  notification rows freeze their locale at write time — so changing the UI language does not
  retranslate history. This needs its own tracker item; **Story 16 modifies no file under `api/`.**
- **No `no-direct-Intl` checker rule exists.** Task 1 fixes the 17 sites inside these nine folders by
  hand, but nothing prevents the 18th from being written tomorrow, here or in an already-migrated root.
  A follow-up could add the rule now that the checker reads `.ts`.
- **Presentational components in `src/components` still take prose as props.** That is the deliberate
  decision from the `common` migration — the caller translates — but it means the checker's
  `TARGET_ATTRS` list (**:36–55**) must grow by hand each time a new prose-carrying prop name is
  introduced. A prop-naming convention (e.g. a `*Text` suffix) would make the list a pattern instead.

**STOP HERE. Report to the user and wait for confirmation before proceeding.**
