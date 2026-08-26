> **Fetched from jira:** [WIS-11](https://ibrahemelahmedy.atlassian.net/browse/WIS-11)  
> *Fetched 2026-08-24T20:38:39.081Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Internationalization (Arabic & English)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Client requirement category 12 (Arabic & English). The translation infrastructure that every other story's RTL acceptance criteria silently depend on: string catalogues, language switcher, per-user locale persistence, document direction switching, and locale-aware date/number formatting.

WIS-1's plan explicitly deferred this: "Arabic translation content... string catalogues land with the i18n story." That story did not exist until now. All nine earlier stories carry an "in RTL/Arabic..." acceptance criterion that cannot be satisfied without this foundation, so it must land early — retrofitting strings after the fact means touching every component again.

Known constraint recorded in WIS-1's plan: the PHP intl extension is blocked on the dev machine by an Application Control policy. This story must decide explicitly whether locale formatting happens client-side (Intl API) or server-side, rather than silently depending on a blocked extension.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/internationalization/WIS-11/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Internationalization (Arabic & English)
- **Feature slug (folder under `plans/`):** `internationalization`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-11` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Internationalization (Arabic & English)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Client requirement category 12 (Arabic & English). The translation infrastructure that every other story's RTL acceptance criteria silently depend on: string catalogues, language switcher, per-user locale persistence, document direction switching, and locale-aware date/number formatting.

WIS-1's plan explicitly deferred this: "Arabic translation content... string catalogues land with the i18n story." That story did not exist until now. All nine earlier stories carry an "in RTL/Arabic..." acceptance criterion that cannot be satisfied without this foundation, so it must land early — retrofitting strings after the fact means touching every component again.

Known constraint recorded in WIS-1's plan: the PHP intl extension is blocked on the dev machine by an Application Control policy. This story must decide explicitly whether locale formatting happens client-side (Intl API) or server-side, rather than silently depending on a blocked extension.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given any user-facing string in the app, when it renders, then it comes from a translation catalogue keyed by locale — no hard-coded English literal survives in a component. Enforce this with a lint rule, not convention alone: a rule that cannot be violated silently is the deliverable, not a one-time cleanup.
- Given a user switches language, when the switch is applied, then the document's `lang` and `dir` attributes update, the layout mirrors, and the choice persists across sessions on the server (per user), not only in localStorage — a user signing in on another machine keeps their language.
- Given a locale, when dates, times, and numbers render, then they use locale-aware formatting. The plan must state explicitly whether this happens client-side (JS Intl API) or server-side, because the PHP `intl` extension is BLOCKED on this dev machine by an Application Control policy (recorded in WIS-1's plan prerequisites) — silently depending on `IntlDateFormatter` or `Number::` will fail at runtime here.
- Given Arabic text, when it renders, then it uses the Arabic font pairing and the ~10-15% increased line-height rule from `docs/design/brief.md` — Latin line-height applied to Arabic at the same size is a defect, not a nuance.
- Given a translation key with no value in the active locale, when rendered, then it falls back to the default locale and the miss is logged — it never renders a raw key (`tickets.queue.title`) or an empty string to the user.
- Given a server-side validation error (Laravel), when it is displayed in an Arabic UI, then the message itself is Arabic — an English server message leaking into an Arabic screen is a failure of this story, so the API must return either localized messages or machine-readable codes the client localizes.
- Given any screen built by any other story, when it renders in RTL, then it uses CSS logical properties (`margin-inline-start`, `padding-inline`) — no second RTL stylesheet exists anywhere in the codebase.
- Given pluralization (e.g. "1 ticket" / "5 tickets"), when rendered in Arabic, then it uses the locale's actual plural rules — Arabic has six plural forms, so a naive `count === 1 ? singular : plural` is incorrect and must not be used.
- Given the language switcher in the App Shell header, when a user changes language, then the current page stays on the same route and does not lose unsaved form state.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| *(e.g. `attachments/flow.png`)* | *(e.g. UX flow)* |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** WIS-10 (the language switcher lives in the App Shell header slot); WIS-1 (per-user locale persists on the `users` row)
- **Depends on code areas or other stories:** **Sequence this early — right after WIS-10.** Every story from WIS-2 onward carries an "in RTL/Arabic..." acceptance criterion that cannot actually be satisfied without this foundation. Landing it late means re-opening every component to replace hard-coded strings.

## Extra notes (optional)

- **Origin of this story:** WIS-1's plan defers to it by name twice — line 41 (*"string catalogues land with the i18n story"*) and line 15 (*"the later i18n work"*) — but no such story existed until the 2026-08-24 gap review. Nine stories were written against a foundation nobody was assigned to build.
- `docs/design/brief.md` "Internationalization" section is binding: Arabic and English are both first-class, RTL mirrors layout/table column order/directional icons (not only text alignment).
- The design system's four existing RTL exports (App Shell, Ticket Queue, Conversation Thread, Customers) are the visual reference for what "mirrored correctly" means — this story supplies the mechanism they assume.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Frontend: pick one i18n library and record why in the plan; verify its Arabic plural-rule support and its RTL story before committing.
- Backend: Laravel's `lang/` catalogues for validation and mail strings; decide and document how the client tells the API which locale it wants (`Accept-Language` header vs. an explicit user preference read from the token) — do not leave this implicit.
- Add a `locale` column to `users` (WIS-1 owns the table; this story adds the column via its own migration).

## Out of scope

- What this story explicitly does **not** cover:
- Translating Knowledge Base article *content* (WIS-5) — articles are author-supplied content, not UI strings; a bilingual article model is a separate decision.
- Customer-facing surfaces (the CSAT response page from WIS-14 needs its own locale decision since there is no signed-in user to read a preference from — flag it there, do not solve it here).
- Multi-branch, multi-department, and custom branding (the rest of client requirement category 12) — those are separate deferred capabilities, not i18n.
- Right-to-left *content* editing concerns such as bidirectional text mixing inside a single message body — out of scope beyond correct `dir` handling.
