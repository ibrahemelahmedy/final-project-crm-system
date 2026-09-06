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

**Measured on 2026-09-02, not estimated:**

- **12 of 14** frontend catalogues are still empty `{}` files.
- **0** components outside `src/app`, `src/features/auth`, and `src/features/sla-rules` call `useT()`
  (112 non-test `.tsx` files across the eleven pending roots).
- **396** literals would be flagged once the eleven roots are added — and roughly **246 more** stay
  invisible even then.
- **21** direct `Intl` / `toLocale*` sites inside those folders; **all 14** `Intl` constructions pass
  `undefined` as the locale, and **9 are module-level constants** that cannot follow a language switch.
- **13** naive `count === 1` pluralization sites.

**The one conflict in the intake, resolved in the plan's Decision 1.** The intake's Dependencies say
the check machinery is "consumed, not redesigned." Its AC1 asks for eleven roots with zero violations;
its AC2 asks that an Arabic screen show no English. **Both cannot hold as the checker stands** — it
never opens `.ts` files and inspects only four DOM attributes, so adding all eleven roots makes AC1
pass while every `.ts` label map, `emptyMessage` prop, and `'Active' : 'Inactive'` ternary still
renders English. AC1 would certify AC2 false.

Story 16 resolves this by **extending what the checker sees while changing no rule it applies**: scan
`.ts`, widen the prose-carrying prop list, walk ternary and template initializers — plus one new
object-literal-property rule, because a `.ts` file contains no JSX and scanning it is otherwise inert.
The AST walk, allowlist format, `runCheck` contract, `npm run i18n:check` wiring, and the asserting
test are untouched. If that rule is rejected in review, AC2 must be struck rather than silently
certified by AC1.

**Two mappings the intake leaves implicit, pinned by the plan:**

1. There is no `web/src/features/conversation/`. The conversation thread is
   `web/src/features/tickets/components/thread/` (20 files, 39 of the tickets tree's 91 violations) and
   owns the **`conversation`** namespace — so the intake's single `src/features/tickets` entry funds
   **two** catalogues, and the other 52 go to `tickets`.
2. `web/src/components/` is shared chrome (`data-table`, `ui`) and extends **`common`** rather than
   gaining a namespace. Its presentational components keep taking prose as props; the **callers**
   translate.

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
Only 6 of 143 PHP files under `api/app` call `__()` — 7 enums, all 7 Request `messages()` overrides,
and several services return raw English that reaches an Arabic screen, with persisted notification rows
freezing their locale at write time. That inventory is verified and preserved in the story's
*Found during planning — outside this story* section so it can be filed as its own tracker item.
**Story 16 modifies no file under `api/`**, and its PR must state that Arabic screens still receive
English server messages until that work lands.
