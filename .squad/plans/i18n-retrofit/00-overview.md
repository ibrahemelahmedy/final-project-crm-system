# i18n-retrofit — plan overview

Entry point for the **i18n-retrofit** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 16 | [16-story-i18n-retrofit.md](16-story-i18n-retrofit.md) | i18n String Extraction Retrofit — Complete WIS-11 Coverage | WIS-17 | Story 15 (WIS-11), and every feature story 03–14 |

## Dependency notes

**This feature exists because WIS-11 shipped the machine, not the retrofit.**
[`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md)
landed the full i18n infrastructure — i18next, `useT`, the four `Intl` formatters,
`UiPreferencesContext.locale`, the `Accept-Language` interceptor, the header switcher, the Arabic font
and line-height, `SetLocale`, `users.locale`, `PATCH /api/user/preferences`, and the
`check-no-literals.mjs` enforcement script — and migrated **two** feature folders through it. Its own
overview names the remainder "String extraction — PENDING", and `web/scripts/i18n-allowlist.json`
tracks that remainder by hand in a `_rootsNote` comment. Story 16 closes it.

The intake states the acceptance signal precisely: **a folder joins `roots` only once its literals are
fully migrated.** `roots` is the contract; `_rootsNote` is the list Story 16 deletes.

**Re-measured on 2026-09-06 after a partial ship — the story file was replanned to match.**

Two of the original eleven roots have since landed: **`src/components`** (folded into `common`) and
**`src/features/tickets`** (into `tickets`, with `components/thread/` in `conversation`). So has the
whole of the checker-coverage work — `check-no-literals.mjs` now scans `.ts`, carries an 18-entry
`TARGET_ATTRS` set, and emits four violation kinds (`jsx-text`, `attr:*`, `object-literal`,
`zod-message`). `node scripts/check-no-literals.mjs` passes today over **171 files / 10 roots**.

What is actually left, measured by running the checker per folder:

- **9** roots pending: `customers`, `knowledge-base`, `notifications`, `reports`, `users-roles-admin`,
  `agent-dashboard`, `agent-productivity`, `channels`, `csat`.
- **488** violations across **165** non-test files — from 89 (`customers`) down to 20 (`notifications`).
- **9 of 18** frontend catalogues still ship as empty `{}` files.
- **17** direct `Intl` / `toLocale*` sites inside those nine folders; **9 are module-level constants**
  that bind the locale at import and cannot follow a language switch. Two of them —
  `reports/model/report.ts:111` (`'en-US'`) and `csat/pages/CsatResponsePage.tsx:24` (`'ar-EG'`) —
  hard-code a locale outright.
- **8** naive `count === 1` pluralization sites.

**The story file is scoped to exactly this remainder.** It does not re-plan the two shipped roots.

**The one conflict in the intake — resolved, and the resolution has shipped.** The intake's
Dependencies say the check machinery is "consumed, not redesigned." Its AC1 asks for every root with
zero violations; its AC2 asks that an Arabic screen show no English. **Both could not hold as the
checker originally stood** — it never opened `.ts` files and inspected only four DOM attributes, so
adding the roots would have made AC1 pass while every `.ts` label map, `emptyMessage` prop, and
`'Active' : 'Inactive'` ternary still rendered English. AC1 would have certified AC2 false.

That was resolved by **extending what the checker sees while changing no rule it applies**: scan
`.ts`, widen the prose-carrying prop list, walk ternary and template initializers, plus one
object-literal-property rule (a `.ts` file contains no JSX, so scanning it is otherwise inert). The
AST walk, allowlist format, `runCheck` contract, `npm run i18n:check` wiring, and the asserting test
were untouched. **This work is done** — the remaining plan consumes the extended checker and adds no
rule of its own.

**Two mappings the intake left implicit — both now settled and shipped:**

1. There is no `web/src/features/conversation/`. The conversation thread is
   `web/src/features/tickets/components/thread/`, and it owns the **`conversation`** namespace — so
   the intake's single `src/features/tickets` entry funded **two** catalogues.
2. `web/src/components/` is shared chrome (`data-table`, `ui`) and extends **`common`** rather than
   gaining a namespace. Its presentational components keep taking prose as props; the **callers**
   translate. That is why the checker's `TARGET_ATTRS` list must grow by hand as new prose-carrying
   prop names appear — recorded as a follow-up in the story file.

**Contracts inherited from WIS-11, consumed and not redesigned:** the key convention
`namespace:screen.element`; the catalogue layout `web/src/i18n/locales/<en|ar>/<namespace>.json`;
`useT` and the four formatters as the only public surface of `web/src/i18n`; Arabic in **Latin digits**
(`numberingSystem: 'latn'`); the API returning ISO timestamps and raw numbers; the client as the
authority on locale, carried by `Accept-Language`.

**Cross-story exception preserved.** [`../csat-collection/13-story-csat-collection.md`](../csat-collection/13-story-csat-collection.md)'s
public CSAT page has no signed-in user. Story 16 absorbs `csatStrings.ts` into the `csat` namespace and
keeps `detectCsatLocale` **behaviourally unchanged** — the page must never write a user preference.

**Out of scope, per the intake:** new translatable copy; non-text RTL/layout defects (WIS-11's
surface); the four deferred categories. **And confirmed out of scope during planning: the backend.**
Only **12 of 201** PHP files under `api/app` call `__()` (re-counted 2026-09-06) — the enums, the Request `messages()` overrides,
and several services return raw English that reaches an Arabic screen, with persisted notification rows
freezing their locale at write time. That inventory is verified and preserved in the story's
*Found during planning — outside this story* section so it can be filed as its own tracker item.
**Story 16 modifies no file under `api/`**, and its PR must state that Arabic screens still receive
English server messages until that work lands.
