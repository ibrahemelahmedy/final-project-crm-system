# i18n-english-leaks — plan overview

Entry point for the **i18n-english-leaks** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 28 | [28-story-i18n-english-leaks.md](28-story-i18n-english-leaks.md) | Closing the Remaining English Leaks in the Arabic UI | WIS-29 | Stories 15, 16, 08, 09, 10, 11, 23 |

## Dependency notes

**This is a correction story, not a feature story.** The owner, using the app in Arabic, reported
substantial untranslated English across many screens even though every existing i18n gate was
green. Phase 1's sweep (in the intake, §0-§9) found why: **the gates were all watching the wrong
place.** Both catalogue-parity tests pass because the missing strings were never *in* a catalogue —
they were hard-coded in PHP `match()` arms that never called `__()`. Planned at **full** depth;
every path and line range was verified against commit `a2b0a12` at plan time.

- **Depends on** [`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md)
  (WIS-11) — owns `api/lang/{en,ar}/enums.php`, `SetLocale`, the `*_label`-travels-with-its-value
  contract this story restores, both existing parity tests, and the
  `parseMissingKeyHandler → humanizeKey` degradation (`web/src/i18n/instance.ts:114-119, 168-176`)
  that is *why* a leak renders as plausible English instead of failing loudly.
- **Depends on** [`../i18n-retrofit/16-story-i18n-retrofit.md`](../i18n-retrofit/16-story-i18n-retrofit.md)
  (WIS-17) — owns `check-no-literals.mjs`, `i18n-allowlist.json`, and the seven
  `web/src/__i18nArabicSweep.*.test.tsx` files. Those sweeps deliberately assert only *chrome*
  strings and hand-feed server labels (`tier_label: 'Enterprise'`) into their fixtures. That scoping
  choice is precisely the hole every leak in intake §1 fell through.
- **Depends on** Stories **08** (audit log + system settings), **09** (knowledge base), **10**
  (quick replies), **11** (notifications) and **04** (ticket category + activity feed) — the six
  screens the leaks are visible on. No behaviour of any of them changes.
- **Depends on** [`../transactional-email/23-story-transactional-email.md`](../transactional-email/23-story-transactional-email.md)
  (WIS-27) — owns `config/mail.php:134` and both customer-facing mailables.
- **Blocks nothing.** A leaf, and the last story of Round 2.

**Contracts this story establishes:**

- **Every enum `label()` in `api/app/Enums/` resolves through `__()`, and a reflection test
  enforces it.** `api/tests/Feature/I18n/EnumLabelLocaleTest.php` no longer names four enums by
  hand — it scans the directory, and any future `label()` that returns a hard-coded English
  `match()` fails the suite. This is the guard the codebase was missing; the two parity tests it
  already had could not see this class of bug at all.
- **Server-derived display copy that is not a backed enum gets its own `lang` file.**
  `AuditTrail::label()` → `api/lang/{en,ar}/audit.php`; `SystemSettings::definitions()` →
  `api/lang/{en,ar}/settings.php`. `enums.php` keeps meaning "backed enum cases", with
  `enums.category` the one documented exception (a `Ticket::CATEGORIES` string rendered exactly
  like an enum label).
- **Form Request `messages()` overrides are deleted, not translated.** The 22 hard-coded messages
  move into `validation.custom`, Laravel's own mechanism — and
  `CatalogueParityTest.php:35`'s blanket `custom.` skip is narrowed to the single placeholder key,
  so those 22 strings are covered by the no-identical-stub rule rather than exempt from it.
- **`MAIL_CUSTOMER_LOCALE` becomes a fallback, not the answer.** A ticket whose subject or
  description contains Arabic renders its customer email in Arabic, via
  `App\Services\CustomerLocale::forTicket()`. No `customers.locale` column, no migration — the
  ticket's own text is the signal. The column remains the right long-term answer and is recorded as
  a follow-up.
- **Seeded demo *content* in English is an explicit, documented deferral, not an oversight.**
  Branch names, department names, quick replies and most KB articles are English; ticket bodies and
  subjects are genuinely bilingual (WIS-25 did that deliberately). Nothing here has a `locale`
  column, so translating it is a separate story. `README.md` and `STATUS.md` say so after this
  story, replacing the now-false claim that the WIS-17 retrofit is incomplete.
