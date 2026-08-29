# Story 15 — Internationalization (Arabic & English) (Story: WIS-11)

> **Contract-level plan.** Stories 01–02 are implemented; this story executes after Story 14.
> Scope, contracts, and acceptance criteria below are final. Task-level file paths and line
> ranges are deliberately absent — regenerate this plan at full depth (`/squad-plan` on the same
> intake) immediately before implementing, once the code it builds on exists.

> **Sequencing note, stated honestly.** The intake argues this story should land right after WIS-10,
> because retrofitting strings means re-opening every component. The binding execution order in
> `.squad/plans/` puts it at **15**, last. That trade was made deliberately: the feature stories ship
> first with English literals and a `labelKey`-style key already assigned next to each (the pattern
> Story 02 set in `navItems.tsx`), so this story replaces **values**, not structure. The retrofit cost
> is real and is this story's main body of work. Do not re-litigate the order; do budget for it.

## Prerequisites

- **Story 01 completed** (`../authentication/01-story-authentication-access-control.md`) — owns the
  `users` table and `UserResource`. This story adds a **`locale` column via its own migration** and adds
  the field to that resource. It does not otherwise touch Story 01's schema. Story 01's plan defers to
  this story by name twice ("string catalogues land with the i18n story").
- **Story 02 completed** ([`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md))
  — supplies three things this story **extends rather than undoes**:
  1. `UiPreferencesContext.tsx` already owns `theme` **and** `direction`, applies
     `document.documentElement.dir`, and persists under `wisal-lang` with `'ar'`/`'en'` values.
     **Extend it. Do not replace it and do not create a second provider.**
  2. **RTL layout is already done** — logical properties throughout the shell, the mirrored drawer with
     its explicit physical `translateX` flip, `direction: ltr` on the `⌘K` badge. This story owns the
     *strings*, not the mirroring.
  3. The header **language-switcher slot exists and ships inert** (`disabled`, `title="Coming soon"`,
     with a comment naming WIS-11). **Fill that slot. Do not restructure the header.**
- **Stories 03–14 completed** — every screen whose literals get extracted. Each feature folder
  (`web/src/features/<slug>/`, `index.ts` its only public surface) gets its own namespace here.
- **Story 13** ([`../csat-collection/13-story-csat-collection.md`](../csat-collection/13-story-csat-collection.md))
  — its public CSAT page has **no signed-in user** and detects locale from the browser with an on-page
  override. This story absorbs `features/csat/model/csatStrings.ts` and **keeps that detection rule**.

---

## Story Goal

1. Every user-facing string renders from a locale-keyed catalogue. No hard-coded English literal survives
   in a component — enforced by a **check that fails the build**, not by convention.
2. A user switches language from the App Shell header: `<html lang>` and `<html dir>` update, the layout
   mirrors, the route is preserved, and unsaved form state survives.
3. The choice persists **on the server, per user** — signing in on another machine keeps the language.
4. Dates, times, and numbers render locale-aware, formatted **client-side** via the JS `Intl` API.
5. Arabic renders in the Arabic font pairing with the increased line-height the design brief requires.
6. A missing key falls back to English and logs the miss — never a raw key, never an empty string.
7. Server-side validation errors read in Arabic on an Arabic UI.
8. Arabic pluralization uses the locale's real plural rules — six forms, not `count === 1`.

**Explicitly out of scope:** translating Knowledge Base article *content* (Story 09 — author-supplied
content, not UI strings); solving the CSAT public page's locale (Story 13 owns it, this story only
absorbs its catalogue); multi-branch, multi-department, and custom branding (the rest of category 12);
bidirectional text mixing inside a single message body beyond correct `dir` handling.

---

## Context — Read These Files First

Only files verified to exist today are listed. Everything else is named by the story that owns it.

1. `.squad/stories/internationalization/WIS-11/intake.md` — the nine acceptance criteria this plan's Done
   Criteria map to 1:1, and the binding constraint on `intl`.
2. `web/src/app/providers/UiPreferencesContext.tsx` — read it end to end before writing a line. Note
   `getInitialDirection()` reads `localStorage['wisal-lang']` and maps `'ar'` → `'rtl'`; note `setDirection`
   writes `'ar'`/`'en'` back under that same key; note both `dataset.theme` and `dir` are applied to
   `document.documentElement`, **not** a wrapper div. The locale becomes the source and direction becomes
   the derived value — the storage key and its value vocabulary stay exactly as they are.
3. `web/src/app/navigation/navItems.tsx` — every entry already carries `labelKey` (`nav.dashboard`,
   `nav.tickets`, …) with the English `label` as its fallback, and the type comment names WIS-11. This is
   the key-naming precedent for the whole app.
4. `../app-shell/02-story-application-shell-navigation.md` — read its Task 6 (the drawer's physical
   `translateX` mirror), its Edge Cases on RTL, and its Done Criteria on the inert header slots. **Those
   Done Criteria change here**: the slot stops being `disabled`.
5. `docs/design/brief.md` — `## Internationalization` (**lines 199–206**): Arabic and English both
   first-class; RTL mirrors layout, table column order, and directional icons, not only text alignment.
   And the typography block (**~lines 116–121**): Arabic pairing is `IBM Plex Sans Arabic` or `Cairo`, and
   **Arabic script needs ~10–15% more line-height than Latin at the same size**.
6. `docs/design/references/1.app-shell/WisalAppShell-LightRTL.dc.html` — **line 20**: the artboard root
   carries `dir="rtl"` *and* switches `font-family` to `'IBM Plex Sans Arabic'`. That font swap is this
   story's job. **Line 54**: the `⌘K` badge's explicit `direction: ltr` — a keyboard shortcut must not
   mirror, and neither must ticket numbers, email addresses, or ISO timestamps. The other three RTL
   exports named in the intake (`2.ticket-queue`, `3.Conversation Thread`, `4.Data Table`) are the visual
   reference for "mirrored correctly"; `14.WisalChannels/WisalChannels-LightLTR.dc.html` shows the header
   language control as a compact **`EN`** pill — the visual target for the filled slot.
7. `web/src/index.css` — the three-block palette structure (bare `:root`, then
   `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`, then `:root[data-theme="dark"]`).
   The Arabic font and line-height tokens follow the same discipline: define once, override by selector.
8. `web/src/lib/api.ts` — the shared Axios instance. The `Accept-Language` request interceptor goes here.
9. `web/package.json` — **there is no `test` script**; the test command is `npx vitest run`. Lint is
   `oxlint` via `npm run lint`. **No i18n library is installed** — the dependency list is
   `@hookform/resolvers`, `@tanstack/react-query`, `axios`, `react`, `react-dom`, `react-hook-form`,
   `react-router-dom`, `zod`.
10. `api/app/Http/Resources/UserResource.php` and `api/app/Models/User.php` — where `locale` is exposed
    and cast. `api/app/Http/Middleware/SecurityHeaders.php` is the precedent for registering a global
    middleware; `SetLocale` follows it.

---

## Decisions this story makes explicitly

The intake requires each of these to be stated rather than left implicit.

**1 — Library: `i18next` + `react-i18next`.**

```bash
cd web && npm i i18next react-i18next
```

Chosen because it is the only mainstream option satisfying all three hard requirements at once: real
CLDR plural categories for Arabic (i18next's JSON **v4** format delegates to `Intl.PluralRules`, which
yields Arabic's six categories — `zero`, `one`, `two`, `few`, `many`, `other` — as separate keys); a
first-class missing-key handler (`saveMissing` + `parseMissingKeyHandler`) so a miss can be logged
instead of rendered; and lazy per-namespace catalogues. **Rejected:** `react-intl` (ICU messages need a
compile step — extra machinery for a two-locale app); `@lingui/react` (macro extraction needs a
Babel/SWC plugin, and this project builds with `@vitejs/plugin-react`). Record the resolved majors in
the PR; `i18next` **must** resolve to ≥ 23 for JSON v4 plurals — check the lockfile and pin if not.

**2 — Locale formatting happens CLIENT-SIDE, via the JS `Intl` API.** The PHP `intl` extension is
**blocked on this dev machine by an Application Control policy** (recorded in Story 01's plan
prerequisites, alongside the same policy blocking `pdo_pgsql` — see `STATUS.md`). Any use of
`IntlDateFormatter`, `NumberFormatter`, `Number::`, or a `Carbon::translatedFormat` chain that reaches
`intl` **will fail at runtime here**. Therefore:
- The API returns **ISO-8601 UTC timestamps and raw numeric values**. It never returns a pre-formatted
  date or a formatted number string.
- The frontend formats everything through `Intl.DateTimeFormat`, `Intl.NumberFormat`, and
  `Intl.RelativeTimeFormat` in a single module.
- Arabic uses **Western (Latin) digits** — locale tag `ar` with `numberingSystem: 'latn'` — because the
  design exports render Latin digits throughout, and mixing Eastern Arabic numerals into layouts built
  against Latin digit widths breaks table alignment. This is a deliberate choice, not an oversight.

**3 — Locale transport: an explicit `Accept-Language` header on every request, sourced from the user's
stored preference.** Not content negotiation from the browser, and not a token claim. The client is the
authority on which locale the user chose; the server echoes it back for validation messages. Reason: the
preference is per-user server state, so the browser's own `Accept-Language` is irrelevant once signed in,
and putting it in the token would require re-issuing the token on every language switch.

**4 — Server messages: Laravel `lang/` catalogues, not client-side codes.** Laravel already ships
`validation.php` machinery, so localizing it is a translation file rather than a protocol redesign. The
API returns localized validation messages in the requested locale. **Exception:** domain errors that the
UI reacts to programmatically (not just displays) keep a stable machine-readable `code` alongside the
localized `message`, so client logic never branches on translated text.

---

## Shared contracts this story establishes

**`users.locale`** — `string(5)`, not null, default `'en'`, allowed values `'en'` | `'ar'`. Added by
**this story's own migration**; Story 01 owns the table, this story owns the column.

**Endpoint** `PATCH /api/user/preferences` — `auth:sanctum`, body `{ "locale": "en" | "ar" }`, returns
the updated `UserResource`. This is the persistence path; there is no other writer of `users.locale`.

**`UserResource`** gains `locale`. Every screen that reads the signed-in user already reads this resource,
so no new fetch is introduced.

**Middleware `app/Http/Middleware/SetLocale.php`** — reads `Accept-Language`, accepts only `en`/`ar`,
falls back to `en` for anything else, calls `App::setLocale()`. Registered globally on the API.

**Backend catalogues** — `api/lang/en/*.php` and `api/lang/ar/*.php`, starting with `validation.php`,
`auth.php`, `passwords.php`. Arabic attribute names go in `validation.php`'s `attributes` array so
`:attribute` interpolates in Arabic, not English.

**Frontend catalogue layout** — `web/src/i18n/locales/<en|ar>/<namespace>.json`:

| Namespace | Owns |
|---|---|
| `common` | shell chrome, `nav.*` (the keys already in `navItems.tsx`), buttons, the four async states, date/number labels |
| `auth` | login screen and session messages |
| one per feature slug | `customers`, `tickets`, `conversation`, `sla`, `dashboard`, `users`, `knowledge`, `productivity`, `notifications`, `reports`, `csat`, `channels` |

**Key convention** — `namespace:screen.element`, lowerCamelCase segments, matching the `nav.dashboard`
precedent. A key is never composed at runtime from a variable fragment, or the extraction check cannot
see it.

**`web/src/i18n/` public surface** — `index.ts` exports the configured `i18n` instance, `useT` (the thin
wrapper over `react-i18next`'s `useTranslation` that pins the namespace), and the formatters
`formatDate`, `formatDateTime`, `formatRelative`, `formatNumber`. **Components import formatters from
here and never call `Intl` or `toLocaleString` directly** — that is what makes locale-awareness auditable.

**`UiPreferencesContext` extension** — the context type gains `locale: Locale` and
`setLocale: (l: Locale) => void`. **`direction` becomes derived** (`locale === 'ar' ? 'rtl' : 'ltr'`)
rather than independently settable; `setDirection` is removed and its callers updated. The existing
`wisal-lang` storage key and its `'ar'`/`'en'` values are kept verbatim, so an existing saved preference
keeps meaning the same thing. `setLocale` does three things: sets state, writes the key, and fires the
`PATCH`. It is **not** removed from `localStorage` — that copy is what prevents a flash of English before
`GET /api/user` resolves on a cold load.

---

## Implementation outline

### Backend (`api/`)

- **Migration adding `users.locale`** — with a default, so existing rows need no backfill. Add `locale`
  to `$fillable` on `app/Models/User.php` and expose it on `app/Http/Resources/UserResource.php`.
- **`app/Http/Controllers/UserPreferencesController.php`** + **`app/Http/Requests/UpdatePreferencesRequest.php`**
  — `locale` required, `in:en,ar`. Writes only the authenticated user's row; there is no `{user}` path
  parameter, which removes the authorization question entirely.
- **`app/Http/Middleware/SetLocale.php`** — as contracted above, registered globally following the
  `SecurityHeaders` precedent.
- **`lang/en/` and `lang/ar/`** — `validation.php` (including the `attributes` map), `auth.php`,
  `passwords.php`. Every custom validation message added by Stories 03–14 gets an Arabic counterpart.
- **Audit for `intl` dependence** — grep `api/app` for `IntlDateFormatter`, `NumberFormatter`,
  `Number::`, and `translatedFormat`. Any hit is removed and the formatting moved to the client. State
  "none found" explicitly if that is the result.
- **Domain error codes** — where Stories 03–14 return an error the UI branches on, add a stable `code`
  field beside the localized `message`. Enumerate the affected endpoints during the full-depth re-plan.

### Frontend (`web/src/`)

- **`i18n/index.ts`** — the i18next instance: `fallbackLng: 'en'`, `supportedLngs: ['en','ar']`,
  `compatibilityJSON` left at the modern default so `Intl.PluralRules` drives plurals,
  `returnEmptyString: false`, `saveMissing: true`, a `missingKeyHandler` that logs (console in dev, a
  counted warning in production), and a `parseMissingKeyHandler` returning the English value — a miss
  degrades to English, never to `tickets.queue.title` and never to `''`.
- **`i18n/formatters.ts`** — the four `Intl`-backed formatters, each taking the active locale from the
  i18next instance so a caller cannot pass the wrong one.
- **`i18n/locales/**`** — the catalogues. Arabic plural keys use the six suffixed forms
  (`_zero`, `_one`, `_two`, `_few`, `_many`, `_other`); English uses `_one` / `_other`. **A naive
  `count === 1 ? a : b` anywhere in the codebase is a defect this story removes.**
- **`app/providers/UiPreferencesContext.tsx`** — **extend, do not replace**, exactly as contracted above.
  It also sets `document.documentElement.lang` next to the `dir` effect that already exists. The i18next
  provider wraps beneath `UiPreferencesProvider` so locale flows one way: provider → i18next → strings.
- **The header language switcher** — **fill Story 02's existing slot.** Remove `disabled` and
  `title="Coming soon"`, keep the globe icon and the `EN`/`AR` pill from the design exports, wire it to
  `setLocale`. **Do not add, move, or reorder a header element.** The control is a two-option toggle, not
  a route change and not a reload — so the route and unsaved form state survive by construction.
- **`index.css`** — an `--font-arabic` token (`'IBM Plex Sans Arabic', 'Cairo', sans-serif`) and an
  `html[lang='ar']` block swapping the family and raising `line-height` **~12%** over the Latin value, per
  the brief's 10–15% rule. Selector-scoped in the one stylesheet — **no second RTL stylesheet, and the
  existing one is not forked.**
- **String extraction across `features/*`** — the bulk of the work. Each feature's literals move to its
  namespace; `navItems.tsx` switches from the `label` fallback to `t(labelKey)`; `csatStrings.ts` is
  absorbed with its browser-detection rule intact.
- **The no-hard-coded-strings check — a deliverable, not a cleanup.** Preferred: enable **oxlint's
  `react/jsx-no-literals`**, after verifying availability with
  `cd web && npx oxlint --rules | grep -i jsx-no-literals`. Fallback if the installed oxlint lacks it:
  ship `web/scripts/check-no-literals.mjs`, walking `src/**/*.tsx` and flagging JSX text nodes plus
  `title`/`aria-label`/`placeholder`/`alt` values with two or more word characters, exiting non-zero;
  wire it as an `i18n:check` script **and** assert it from `src/i18n/noHardcodedStrings.test.ts` so
  `npx vitest run` fails on a violation — a check only CI runs is discovered late. Either way, an
  **allowlist file** records every deliberate exception (`⌘K`, "Wisal", ISO codes) with a reason each.

---

## Edge Cases & Failure Modes

- **Flash of the wrong language on cold load.** `localStorage['wisal-lang']` is read synchronously before
  first paint (the provider already does this for direction); the server value from `GET /api/user`
  arrives later and reconciles. If they disagree, **the server wins** and the local copy is corrected —
  that is what makes "signing in on another machine keeps their language" true.
- **`PATCH /api/user/preferences` fails while the UI already switched.** The UI stays switched (a network
  blip does not undo the user's intent) and the request retries once; a second failure surfaces a
  non-blocking toast. The local copy still persists the choice on this device.
- **A key present in `en` and missing in `ar`.** Falls back to English and logs the miss; a key-set parity
  test makes it fail in CI rather than reach a user. **Missing in both** → `parseMissingKeyHandler`
  returns the last key segment humanized, never the raw dotted key and never `''`.
- **Arabic plurals.** A catalogue entry providing only `_one`/`_other` renders `_other` for 2, 3, and 11 —
  grammatically wrong. Every count-bearing key must carry all six Arabic CLDR forms; a test asserts that.
- **`Intl` numbering system.** `new Intl.NumberFormat('ar')` defaults to Eastern Arabic numerals in most
  runtimes. Every formatter must pass `numberingSystem: 'latn'` explicitly per decision 3, or table
  columns built against Latin digit widths will jump.
- **Content that must not mirror.** Ticket numbers, email addresses, URLs, phone numbers, code snippets,
  and the `⌘K` badge. The badge already carries `direction: ltr` from Story 02; the rest need `dir="ltr"`
  or a `.ltr-content` utility. User-authored message bodies get `dir="auto"`.
- **Arabic line-height applied globally instead of scoped.** Raising the base `line-height` unconditionally
  loosens every English screen. Scope it to `[lang='ar']` only.
- **Server validation error in the wrong language.** Happens when a request omits `Accept-Language` — a
  request issued outside `lib/api.ts`. Grep for every direct `axios`/`fetch` call in `web/src` and route
  it through the shared instance, or the interceptor is bypassed silently.
- **The CSAT public page** has no user and no session, so its locale comes from the browser. Story 13's
  detection rule is preserved verbatim.
- **Genuine uncertainty — whether the installed `oxlint` ships `react/jsx-no-literals`.** oxlint's rule
  coverage moves quickly and the installed version is `^1.79.0`. Verify with the command above during the
  full-depth re-plan; the fallback script exists precisely because this cannot be confirmed today.
- **Genuine uncertainty — how many hard-coded literals Stories 03–14 actually leave behind.** The volume
  is unknowable until that code exists. The extraction pass is scoped by the check's output, not by an
  estimate made now.
- **Genuine uncertainty — whether `IBM Plex Sans Arabic` is self-hosted or loaded from a font CDN.** The
  design exports pull Google Fonts over the network. Decide during the re-plan; a missing Arabic face
  falls back to a system Arabic font, which changes metrics and silently breaks the line-height rule.

---

## Test Plan

Backend (Pest, matching `api/tests/Feature/`):

1. **`tests/Feature/I18n/LocalePreferenceTest.php`** — `PATCH /api/user/preferences` with `ar` persists
   and is reflected in `GET /api/user`; `fr` is 422; unauthenticated is 401; the endpoint writes only the
   caller's own row.
2. **`tests/Feature/I18n/LocalizedValidationTest.php`** — a failing login with `Accept-Language: ar`
   returns an **Arabic** message with an Arabic `:attribute`; `en`, no header, and an unsupported header
   all return English.
3. **`tests/Feature/I18n/CatalogueParityTest.php`** — every key in `lang/en/**` exists in `lang/ar/**`,
   and no Arabic value is byte-identical to its English counterpart (catching copy-paste stubs).
4. **Regression** — `tests/Feature/ApiContractTest.php` and the auth suites still pass with `SetLocale`
   registered globally.

Frontend (Vitest + Testing Library):

5. **`src/i18n/catalogueParity.test.ts`** — `en` and `ar` key sets identical per namespace; every
   count-bearing key carries all six Arabic plural forms; no value is an empty string.
6. **`src/i18n/formatters.test.ts`** — the same timestamp renders differently in `en` and `ar`; numbers
   use **Latin** digits in both; relative time is correct in both; every formatter is locale-driven.
7. **`src/i18n/missingKey.test.ts`** — a key present only in `en` renders the English value **and** calls
   the missing-key handler; a key present in neither renders neither the raw dotted key nor `''`.
8. **`src/i18n/noHardcodedStrings.test.ts`** — the literal check runs over `src/**/*.tsx` and passes; a
   fixture with a bare JSX literal makes it fail. **This is the enforcement deliverable — if this test is
   deleted or skipped, the first acceptance criterion is not met.**
9. **`src/app/providers/UiPreferencesContext.test.tsx`** — `setLocale('ar')` sets `<html lang="ar">` **and**
   `<html dir="rtl">`, writes `wisal-lang=ar`, and issues the `PATCH`; `direction` is derived and no longer
   independently settable; **Story 02's assertion that nothing writes to `localStorage` on mount still
   holds** (`localStorage.length === 0` with no prior choice).
10. **`src/app/layouts/AppLayout.i18n.test.tsx`** — the header language control is **enabled**, switching
    locale re-renders nav labels in Arabic, **the route is unchanged**, and text typed into a form input
    is **still present** afterwards.
11. **Regression** — Story 02's 12 login tests and its `it.each(navItems)` route test pass. Nav labels now
    come from `t(labelKey)`; if the route test needs changing, the change is wrong.
12. **Manual only** — Arabic font rendering, the raised line-height, and full-screen RTL mirroring against
    the four RTL exports. jsdom resolves neither computed CSS nor real bidi layout. Do not fake it with a
    snapshot that asserts nothing real.

---

## Verification Steps

1. **Install:** `cd web && npm i i18next react-i18next` — record the resolved majors; `i18next` must be ≥ 23.
2. **Backend tests pass:** `php artisan test` in `api/` — new I18n suites green, every pre-existing test green.
3. **No `intl` dependence:** `grep -rn "IntlDateFormatter\|NumberFormatter\|translatedFormat\|Number::" api/app`
   — **zero hits**. Any hit is a runtime failure waiting on this machine.
4. **Frontend typechecks and lints:** `npm run build` and `npm run lint` in `web/` — zero errors, and the
   literal rule (or the fallback script via `npm run i18n:check`) reports zero violations.
5. **Frontend tests pass:** `npx vitest run` in `web/` — the eight i18n suites green, every Story 02–14
   suite unchanged.
6. **No second RTL stylesheet:** `grep -rn "margin-left\|margin-right\|padding-left\|padding-right\|border-left\|border-right" web/src --include=*.css`
   — hits only inside the documented exceptions (`translateX` mirroring, `direction: ltr` content).
7. **Manual:** `php artisan serve` + `npm run dev`. Sign in, open a screen with an unsaved form field, type
   into it, switch to **AR** from the header: the page stays on the same route, the typed text survives, the
   layout mirrors, `<html lang="ar" dir="rtl">`, dates and counts read Arabic with Latin digits. Submit an
   invalid form — the server's message is Arabic. Sign out, sign in **in a different browser** — still Arabic.

---

## Done Criteria

- [ ] Every user-facing string renders from a locale-keyed catalogue; no hard-coded English literal survives in a component, enforced by a rule or script that **fails `npm run lint` or `npx vitest run`** — not by convention, and with every exception recorded in an allowlist with a reason.
- [ ] Switching language updates `<html lang>` and `<html dir>`, mirrors the layout, and persists **on the server per user** — a user signing in on another machine keeps their language.
- [ ] Dates, times, and numbers use locale-aware formatting done **client-side via the JS `Intl` API**; the API returns ISO timestamps and raw numbers, and `grep` finds no `IntlDateFormatter` / `NumberFormatter` / `Number::` anywhere in `api/app`.
- [x] Arabic renders in the Arabic font pairing with line-height raised ~10–15% over Latin, scoped to `[lang='ar']`.
- [x] A key missing in the active locale falls back to English **and** logs the miss; it never renders a raw key or an empty string.
- [ ] A Laravel validation error displayed in an Arabic UI is **in Arabic**, including the interpolated attribute name; errors the UI branches on carry a stable machine-readable `code` beside the localized message.
- [x] Every screen mirrors under RTL using CSS logical properties, with **no second RTL stylesheet anywhere** in the codebase.
- [ ] Pluralization uses the locale's real plural rules — all six Arabic CLDR forms are present for every count-bearing key, and no `count === 1 ? … : …` remains.
- [x] Changing language from the App Shell header keeps the current route and does not lose unsaved form state — asserted by a test, not by inspection.
- [x] The header language switcher **fills Story 02's existing slot**: no longer `disabled`, no header element added, moved, or reordered.
- [x] `UiPreferencesContext` is **extended, not replaced**: it still owns theme, now owns locale, derives direction from it, keeps the `wisal-lang` key and its `'ar'`/`'en'` values, and still writes nothing to `localStorage` on mount.
- [ ] Story 13's CSAT public page keeps its browser-detected locale rule after its strings are absorbed into the shared catalogue.
- [x] Overview `00-overview.md` updated with this story.
