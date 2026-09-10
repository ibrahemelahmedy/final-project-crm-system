> **Fetched from jira:** [WIS-28](https://ibrahemelahmedy.atlassian.net/browse/WIS-28)
> *Fetched 2026-09-10T12:04:02.476Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Style the WIS-23 AI surfaces — classification card + chat citations
**Type:** Story
**Status:** To Do
**Assignee:** ibrahem elahmady

### Description

*(The tracker's rendering of the WIS-23 issue link expanded into a smart-link card; it is collapsed
back to the plain text "WIS-23" below. Nothing else is edited.)*

```
Context

WIS-23 shipped auto-classification and the portal chatbot working, but with no CSS for its six
new class names — classification-ai* on ClassificationCard.tsx (the AI suggestion chip in the
ticket thread) and portal-chat-citations* on ChatCitations.tsx (the KB citation links in the
chatbot). They render as unstyled default HTML.

Goal

Both surfaces match docs/design/brief.md: tokens only (no hardcoded colours), RTL/LTR mirrored,
dark-theme complete, the AI badge convention preserved (Latin "AI" chip), Loading/Empty states
where relevant, WCAG-AA contrast, visible focus.

Scope

	The classification suggestion chip on the ticket thread: category + priority + confidence, an
	"apply" affordance, a dismiss affordance, and the needs_triage state.

	The chatbot citation list: linked article slugs → /portal/faq/{slug}, wrapping, hover/focus.

	Add the rules to the existing feature CSS files (web/src/index.css currently holds the class
	refs — move to the right feature stylesheet if that is the repo pattern).

	No new component logic; styling + minimal markup adjustments only.

Done criteria

	[ ] Every new class name has a rule; nothing renders unstyled.

	[ ] Tokens only — grep for hex/rgb in the new rules returns nothing.

	[ ] Correct in dark theme and in Arabic RTL (screenshot or explicit structural check).

	[ ] Focus visible on every interactive element; contrast computed, not assumed.

	[ ] npm run test + npm run build + npm run lint green.

	[ ] wisal-ui-review skill run against both surfaces with no blocking findings.
```

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ai-surface-styling/WIS-28/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Styling the AI Surfaces — Classification Card & Chat Citations
- **Feature slug (folder under `plans/`):** `ai-surface-styling`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-28` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Style the WIS-23 AI surfaces — classification card + chat citations
```

---

## Description

*(See the Source block above — the description is reproduced there verbatim, with only the
expanded WIS-23 smart-link card collapsed back to plain text.)*

---

## Acceptance criteria

*(Copied verbatim from the Jira issue's "Done criteria" block. These six are the story's Done
Criteria and the plan must reproduce them word-for-word.)*

```
[ ] Every new class name has a rule; nothing renders unstyled.
[ ] Tokens only — grep for hex/rgb in the new rules returns nothing.
[ ] Correct in dark theme and in Arabic RTL (screenshot or explicit structural check).
[ ] Focus visible on every interactive element; contrast computed, not assumed.
[ ] npm run test + npm run build + npm run lint green.
[ ] wisal-ui-review skill run against both surfaces with no blocking findings.
```

All six are verifiable in this repository with no external account, no live key and no browser:
criteria 1, 2 and 4 are `grep`-checkable over the new rule blocks, criterion 3 is discharged by a
**structural** check (logical properties only + every token used already defined in all four theme
blocks) rather than a screenshot, criterion 5 is three npm scripts, and criterion 6 is a skill this
repo already ships (`wisal-ui-review`).

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| — | — |

None. Every fact this story needs is in the repository; exact paths are under **Technical hints**.

---

## Dependencies

- **Blocked by:** nothing. WIS-23 is shipped and cleared (commit `6a008f9`, plan-review PASSED
  2026-09-09) — this story is the cosmetic remainder its plan-review recorded as a non-blocking
  deviation: *"the commit adds no CSS, so `portal-chat-citations*` and `classification-ai*` render
  unstyled (cosmetic)."*
- **Depends on code areas / other stories:**
  - **Story 19 — ai-assist-panel (WIS-18)**, `.squad/plans/ai-assist-panel/19-story-ai-assist-panel.md`.
    Owns the whole AI visual language this story must rhyme with: the `--ai-*` token family
    (`web/src/index.css:151-155` light, `:278-282` media-dark, `:401-405` data-theme-dark,
    `:524-528` data-theme-light), the `.assist-card` / `.assist-chip` / `.assist-use-btn` /
    `.assist-dismiss-btn` rules (`web/src/index.css:2550-2657`) and **Decision 6 — the "AI" chip
    stays Latin in Arabic** (already allowlisted at `web/scripts/i18n-allowlist.json` `literals`).
  - **Story 24 — ai-customer-intelligence (WIS-23)**,
    `.squad/plans/ai-customer-intelligence/24-story-ai-customer-intelligence.md`. Owns both
    components and all six class names. Its Task 24 (`ClassificationCard`) and Task 22
    (`ChatCitations`) are the markup this story styles.
  - **Story 17 — customer-portal (WIS-16)**, owner of `web/src/features/portal/portal.css` and its
    Decision 3 section (*"the five undesigned screens"*), which is the precedent for styling a
    portal screen that has no artboard.
  - **Story 04 — ticket-management (WIS-2)**, owner of `--prio-*` (the amber
    `badge_text_on_tint` pair the `needs_triage` pill reuses) and of `.classification-chip`
    (`web/src/index.css:2508-2516`), the base class the triage pill modifies.

## Extra notes (optional)

Findings from reading the code at intake time. Each is a fact the planner and the execute agent
should not have to rediscover.

1. **The Jira Context is slightly wrong about where the refs live.**
   `grep -rn "classification-ai\|portal-chat-citation" web/src` returns **ten hits, all in the two
   `.tsx` files** — `web/src/features/tickets/components/thread/ClassificationCard.tsx:38,42,45,55,56,63,69,82`
   and `web/src/features/portal/components/ChatCitations.tsx:16,17`. `web/src/index.css` contains
   **zero** occurrences of either prefix. There is therefore **nothing to move**: this story only
   *adds* rules.

2. **`.classification-chip-triage` is a seventh unstyled class**, not one of the "six" the issue
   counts. `ClassificationCard.tsx:39` renders `classification-chip classification-chip-triage`;
   the base `.classification-chip` **is** styled (`web/src/index.css:2509-2516`) but the `-triage`
   modifier is not. Full unstyled set: `classification-ai`, `classification-ai-note`,
   `classification-ai-btn`, `classification-chip-triage`, `portal-chat-citations`,
   `portal-chat-citations-label`.

3. **The tickets feature has no stylesheet of its own.** `find web/src -name "*.css"` returns
   exactly four files: `web/src/index.css`, `web/src/features/portal/portal.css`,
   `web/src/features/channels/channels.css`, `web/src/features/csat/csat.css`. Every thread and
   meta-panel rule — including `.classification-chips`, `.classification-chip` and the entire
   `.assist-*` block — lives in `index.css`. The repo pattern therefore puts `classification-ai*`
   in **`index.css`** (a new `web/src/features/tickets/tickets.css` would be the deviation, not the
   convention) and `portal-chat-citations*` in **`portal.css`**, which `PortalLayout.tsx:5` already
   imports.

4. **Zero new design tokens are needed.** Both surfaces can be built entirely from tokens already
   defined in all four theme blocks: `--ai-card-bg`, `--ai-card-border`, `--ai-chip-bg`,
   `--ai-chip-fg`, `--ai-body-fg`, `--ai-action-fg`, `--prio-high-bg`, `--prio-high-fg`,
   `--border-card`, `--bg-card`, `--text-muted`, `--btn-bg`, `--nav-active-fg`. This is what makes
   Done Criterion 3 (dark theme) free: no token declaration is added, so no theme block needs
   editing and dark mode cannot drift.

5. **`portal.css` writes `var(--token, #fallback)` everywhere; the new rules must not.** Done
   Criterion 2 says a hex/rgb grep over the new rules returns nothing, and a fallback is a hex.
   Dropping the fallbacks is safe: `web/src/main.tsx:3` imports `index.css` globally, so every
   `:root` token is present on the document that renders the portal too.

6. **The classification card lives in a 300px column.** `TicketMetaPanel.tsx:112` is
   `<aside className="meta-panel">`; `.meta-panel` is `inline-size: 300px` with `padding: 20px`
   (`web/src/index.css:2417-2426`), i.e. a **260px** content box. Apply + Dismiss must be able to
   wrap, and a long localised category label must wrap rather than overflow.

7. **The citation list renders inside the assistant bubble, not on the page.**
   `ChatBubble.tsx:22` mounts `<ChatCitations>` inside `.portal-message.portal-message-agent`,
   whose background is `var(--bg-page)` (`portal.css:298-301`). Contrast must be computed against
   `--bg-page` (light `#F8FAFC`, dark `#121317`) — **not** against `--bg-card`.

8. **`ChatCitations` already ships its Empty state**: `ChatCitations.tsx:13` returns `null` for an
   empty array. That is correct and must stay — a grounded answer with no citations shows nothing,
   and the parent bubble is the content. Neither surface warrants a skeleton: the classification
   arrives inside the ticket payload and the citations inside the chat message payload, so there is
   no separate fetch to be loading.

9. **`"AI"` is already allowlisted** at `web/scripts/i18n-allowlist.json` `literals`, with WIS-18
   Decision 6 as the recorded reason. Adding a Latin `AI` pill to `ClassificationCard` therefore
   passes `npm run i18n:check` (`node scripts/check-no-literals.mjs`) with no allowlist edit —
   and `src/features/tickets` and `src/features/portal` are both enforced roots.

10. **`ClassificationCard.test.tsx` exists (5 tests, added by WIS-23's plan-review as Test Plan
    item L67); `ChatCitations.test.tsx` does not.** `ls web/src/features/portal/components/*.test.tsx`
    returns only `OtpInput.test.tsx` and `RequirePortalSession.test.tsx`.

11. **jsdom cannot prove a class resolves to a rule.** Vitest runs with the jsdom environment and
    no stylesheet is loaded into it, so `getComputedStyle` returns the UA defaults for everything.
    Tests must assert **structure, class names, `href`s and aria** — the CSS itself is gated by
    `grep` checks plus `npm run build` (which runs `tsc -b` then Vite, and Vite parses the CSS).

12. **Focus convention in this repo** is `outline: 2px solid var(--nav-active-fg); outline-offset:
    2px;` in `index.css` (e.g. `:2408`, `:2437`, `:2465`, `:2496`) and `outline: 2px solid
    var(--btn-bg); outline-offset: 2px;` in `portal.css:57-61` (`.portal-toggle:focus-visible,
    .fv:focus-visible`). Each new surface follows its own file's convention.

13. **Contrast pairs, computed at intake time from the WCAG relative-luminance formula**, not read
    off a palette. The dark-theme card ground is the *composite* of `--ai-card-bg`
    `rgba(167, 139, 250, 0.14)` over `--meta-panel-bg` `#1C1D24`, which is `≈ #2F2C42` — computing
    against the rgba string alone would be wrong:
    - Dismiss (and any text on the card) `--ai-action-fg` `#7C3AED` on `--ai-card-bg` `#F5F3FF` —
      **5.19:1** light; `#C4B5FD` on `≈ #2F2C42` — **7.25:1** dark. **Passes both.**
    - Apply as a raised button, `--ai-action-fg` on `--bg-card`: `#7C3AED` on `#FFFFFF` —
      **5.70:1** light; `#C4B5FD` on `#1C1D24` — **8.49:1** dark. **Passes both.**
    - Triage pill `--prio-high-fg` `#B45309` on `--prio-high-bg` `#FFFBEB` — **4.84:1**, the exact
      `badge_text_on_tint` pair `brief.md:109` records. Dark `#FBBF24` on
      `rgba(251, 191, 36, 0.14)` over the card — comfortably above 7:1.
    - Body text `--ai-body-fg` `#4C1D95` on `#F5F3FF` — **9.99:1** light.
    - Citation link `--btn-bg` on a `--bg-card` chip: `#4F46E5` on `#FFFFFF` — **6.29:1** light
      (the pair `brief.md:72` verifies); `#818CF8` on `#1C1D24` — **5.63:1** dark.
    - Citation label `--text-muted` `#64748B` on `--bg-page` `#F8FAFC` — **4.55:1** light (it
      passes, but only just); `#94A3B8` on `#121317` — **7.24:1** dark.
    - **A measured trap:** `--text-muted` `#64748B` on `--ai-card-bg` `#F5F3FF` is **4.34:1** —
      it **fails** AA. The muted grey that is correct everywhere else in the app is wrong inside
      the classification card. Secondary text there (the confidence line) must stay
      `--ai-body-fg` and be de-emphasised by **size**, never by switching to `--text-muted` and
      never by `opacity`, which lowers contrast the same way.

14. **One measured shortfall, and it is pre-existing and NOT this story's to fix.** WIS-18's
    `.assist-chip` (`index.css:2573-2584`) paints `--ai-chip-fg` `#FFFFFF` on `--ai-chip-bg`. Light
    `#FFFFFF` on `#7C3AED` is **5.70:1** (passes); **dark `#FFFFFF` on `#8B5CF6` is 4.24:1**, which
    is below the 4.5:1 AA minimum for a 10px/700 badge (it would only pass as "large text" at
    ≥ 18.66px, or ≥ 14px bold). The issue's Goal explicitly requires *"the AI badge convention
    preserved (Latin 'AI' chip)"*, so this story **reuses `.assist-chip` verbatim and adds no
    rule for it** — changing `--ai-chip-bg` is a WIS-18-owned token edit that would repaint every
    existing AI surface and is out of scope here. Record it as a follow-up, do not fix it, and do
    not let a `wisal-ui-review` finding about `.assist-chip` block this story: the finding is
    about a rule this story does not add.

15. **Never paint the Apply button with `--ai-chip-bg`.** The obvious move — copy
    `.assist-use-btn` (`index.css:2604-2613`), which is solid `--ai-chip-bg` with `--ai-chip-fg`
    text — inherits exactly the 4.24:1 dark-theme failure in finding 14, this time on an element
    that *is* interactive and *is* in this story's diff, which would fail Done Criterion 4
    outright. Use the raised-button pair measured in finding 13 instead.

16. **RTL needs no direction-specific rule if the rules are written in logical properties.** Both
    files already state this as their own convention (`portal.css:1`, and the `.assist-*` header
    comment at `index.css:2550-2557`). The one genuine RTL hazard is **content**, not layout: KB
    article titles can be English while the UI is Arabic (`kb_articles` has no `locale` column —
    WIS-23's own finding (a)), so a citation title needs `dir="auto"`.

## Technical hints (optional)

- **Files this story owns (expected diff):**
  - `web/src/index.css` — one new rule block appended to the AI-Assist section, after
    `.assist-skeleton-actions` (`:2657`) and before `.tq-subject-link` (`:2659`).
  - `web/src/features/portal/portal.css` — one new rule block appended at the end of the file
    (currently 449 lines), inside the Decision-3 "undesigned screens" section.
  - `web/src/features/tickets/components/thread/ClassificationCard.tsx` — markup only: an `AI`
    pill and two wrapper elements.
  - `web/src/features/portal/components/ChatCitations.tsx` — markup only: two class names and
    `dir="auto"`.
  - `web/src/features/tickets/components/thread/ClassificationCard.test.tsx` — extended.
  - `web/src/features/portal/components/ChatCitations.test.tsx` — **new**.
- **Files this story must NOT touch:** any `api/**` path; the four `:root` theme blocks in
  `index.css` (`:43`, `:195`, `:321`, `:442`); `web/scripts/i18n-allowlist.json`; both
  `conversation.json` and both `portal.json` catalogues (no new user-facing string is needed —
  every label the two components render already exists); `web/package.json`.
- **Commands:** `cd web && npm run test`, `npm run build`, `npm run lint` (which is `oxlint` then
  `node scripts/check-no-literals.mjs`).
- **Baseline to beat:** at the end of Round 1 the suite was **frontend 623 pass / 101 files**, with
  `build`, `lint` and `i18n:check` clean (`.squad/pipeline.md`, "Suite at pipeline end").

## Out of scope

- **Any component logic change.** No new state, no new hook, no new query, no new endpoint, no
  changed props, no changed conditional. The render conditions in `ClassificationCard.tsx:24-27`
  and the `citations.length === 0` guard in `ChatCitations.tsx:13` are frozen.
- **Any new i18n key or catalogue edit.** If a design idea needs a new string, drop the idea.
- **Any new design token**, and therefore any edit to the four theme blocks.
- **Restyling the surfaces WIS-23 did not leave unstyled** — `ChatBubble`'s three inline `style`
  objects (`ChatBubble.tsx:16,19,23`), `ChatNotice`, `ChatComposer`, `PortalStates`, the rest of
  the meta panel, and `.portal-message-customer`'s hardcoded `#fff` are all pre-existing and stay.
- **A `web/src/features/tickets/tickets.css` extraction.** Splitting the 4,535-line `index.css`
  into feature stylesheets is a real piece of work and a separate story; doing a slice of it here
  would leave the file half-migrated.
- **Screenshots / a running browser.** Done Criterion 3 is discharged structurally (see the
  Acceptance-criteria note above).
- **`api/**` and the backend.** Nothing server-side changes.
