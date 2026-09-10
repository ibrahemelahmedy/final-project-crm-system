# Story 27 — Style the WIS-23 AI Surfaces: Classification Card & Chat Citations (Story: WIS-28)

---

## Prerequisites

- **Story 24 completed** — [`../ai-customer-intelligence/24-story-ai-customer-intelligence.md`](../ai-customer-intelligence/24-story-ai-customer-intelligence.md)
  (commit `6a008f9`, plan-review PASSED 2026-09-09). It owns both components and all six unstyled
  class names. Its plan-review recorded the gap this story closes, verbatim: *"the commit adds no
  CSS, so `portal-chat-citations*` and `classification-ai*` render unstyled (cosmetic)."*
  **Every WIS-23 decision still binds** — in particular that applying a suggestion is the existing
  `PATCH /api/tickets/{id}` and that there is deliberately no apply endpoint. This story changes no
  behaviour of either component.
- **Story 19 completed** — [`../ai-assist-panel/19-story-ai-assist-panel.md`](../ai-assist-panel/19-story-ai-assist-panel.md).
  Owns the AI visual language: the `--ai-*` token family and the `.assist-*` rule block. **Decision
  6 binds**: the `AI` badge stays Latin in Arabic, and `"AI"` is already in
  `web/scripts/i18n-allowlist.json` `literals` with that reason recorded.
- **Story 17 completed** — [`../customer-portal/17-story-customer-portal.md`](../customer-portal/17-story-customer-portal.md).
  Owns `web/src/features/portal/portal.css` and its **Decision 3** section — *"the five undesigned
  screens"* — which is the in-repo precedent for styling a portal surface that has no artboard.
  The chat screen is one of those screens.
- **Story 04 completed** — [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md).
  Owns `.classification-chip` and the `--prio-*` token pairs, including the amber
  `badge_text_on_tint` pair the `needs_triage` pill reuses.

Nothing else is in flight. This is a **frontend-only, CSS-and-markup-only** story.

---

## Story Goal

Give the two AI surfaces WIS-23 shipped bare a designed appearance that is indistinguishable in
quality from the AI Assist panel next to them.

1. **The classification suggestion in the ticket meta panel** reads as one AI-authored card — the
   violet `--ai-*` surface with the Latin `AI` pill — carrying the suggested category and priority,
   the confidence, an **Apply** affordance and a **Dismiss** affordance, plus a distinct amber
   `Needs triage` state when the assistant was not confident.
2. **The chatbot's KB citations** read as a labelled, wrapping row of tappable article chips at the
   foot of the assistant's bubble, each opening `/portal/faq/{slug}`.

Both are correct in dark theme and in Arabic RTL, use **only** tokens already defined, and show a
visible focus ring on every interactive element.

**Not in scope, and the plan will be judged on this:** no component logic, no new state, no new
hook, no new prop, no changed render condition, no new i18n key, no catalogue edit, no new design
token, no edit to the four `:root` theme blocks, no `api/**` change, no `tickets.css` extraction,
and no restyling of any surface WIS-23 left *styled*.

---

## Context — Read These Files First

1. `web/src/features/tickets/components/thread/ClassificationCard.tsx` — **read the whole file (92
   lines)**. Two mutually exclusive branches: the `needs_triage` block at `:37-52` and the `differs`
   block at `:54-89`. Note that `hasSuggestion` (`:24`) and `differs` (`:25-27`) are the render
   conditions and are **frozen**. Note that both branches already carry `role="status"`.
2. `web/src/features/portal/components/ChatCitations.tsx` — **read the whole file (29 lines)**. The
   `citations.length === 0` early return at `:13` is this surface's Empty state and stays. The
   `<ul>` at `:18` and the `<li>` at `:20` are unclassed today.
3. `web/src/index.css` — ranged reads only:
   - `~lines 2417–2433` — `.meta-panel` (`inline-size: 300px`, `padding: 20px`) and
     `.meta-section-label`. This is the 260px content box the card must survive.
   - `~lines 2508–2516` — `.classification-chips` and `.classification-chip`, the base class the
     triage pill modifies.
   - `~lines 2550–2657` — the whole `.assist-*` block, including its header comment
     (`:2550-2557`) which states the two contracts this story inherits: *"Every AI-produced
     surface uses this violet card + the `AI` chip"* and *"All sizing is logical so the RTL
     artboards mirror with no direction-specific rule."* Read `.assist-chip` at `:2573-2584` and
     `.assist-use-btn` at `:2604-2613` specifically — the first is reused verbatim, the second is
     **deliberately not** (Decision 4).
   - `~lines 151–155` — the `--ai-*` tokens on bare `:root`. Their three siblings are at
     `:278-282` (`@media (prefers-color-scheme: dark)`), `:401-405` (`:root[data-theme="dark"]`)
     and `:524-528` (`:root[data-theme="light"]`). **You will not edit any of the four.**
   - `~lines 101–104` — `--prio-high-fg` / `--prio-high-bg`, with the `badge_text_on_tint` note.
4. `web/src/features/portal/portal.css` — ranged reads only:
   - `line 1` — *"Story 17 (WIS-16). CSS logical properties only — no left/right."*
   - `~lines 57–61` — `.portal-toggle:focus-visible, .fv:focus-visible`, this file's focus
     convention (`outline: 2px solid var(--btn-bg); outline-offset: 2px`).
   - `~lines 169–179` — `.portal-link`, which the citation `Link` already carries and which
     supplies its colour, weight and `text-decoration: none`.
   - `~lines 286–306` — `.portal-message`, `.portal-message-customer`, `.portal-message-agent`
     (background `var(--bg-page, #f1f5f9)`) and `.portal-message-system`. The citation block
     renders **inside** `.portal-message-agent`.
   - `~lines 313–316` — the Decision-3 header comment for the undesigned screens.
5. `web/src/features/portal/components/ChatBubble.tsx:22` — confirms `<ChatCitations>` mounts
   inside the agent bubble. Its three inline `style` objects (`:16`, `:19`, `:23`) are pre-existing
   and **out of scope**.
6. `docs/design/brief.md` — `~lines 62–125` (the token block, including `badge_text_on_tint` at
   `:107-110` and the verified primary pair at `:72`), `~lines 189–197` (Accessibility: *"Focus
   states always visible — `outline: none` without a replacement is forbidden"*), `~lines 199–206`
   (Internationalization).
7. `web/scripts/i18n-allowlist.json` — confirm `"AI"` is present in `literals` and that
   `src/features/tickets` and `src/features/portal` are both enforced `roots`. **Do not edit this
   file.**
8. `web/src/features/tickets/components/thread/ClassificationCard.test.tsx` — the five existing
   tests. You will **extend**, never rewrite; every existing assertion must survive.
9. `web/src/features/portal/testUtils.tsx` — `~lines 15–40`, the `renderPortal` harness (Query
   client → `UiPreferencesProvider` → `I18nextProvider` → `MemoryRouter`). Task 6's new test uses
   it; `PortalChatPage.test.tsx:7` shows the import. `web/src/features/tickets/components/thread/testUtils.tsx:51-58`
   is the ticket-side equivalent, `renderWithProviders`, which Task 5 already uses.

**Grep lines to run before you start, and again at the end:**

```bash
cd web
grep -rn "classification-ai\|portal-chat-citation" src        # 10 hits before, ~16 after; all in .tsx + the two .css files
grep -rn "classification-ai\|portal-chat-citation" src/index.css   # 0 hits before — there is NOTHING to move
```

---

## Product rules (from story)

| | Current behaviour | New behaviour |
|---|---|---|
| Classification suggestion | Unstyled `div` + `p` + two default-chrome `button`s, stacked, no card, no AI badge | A violet `--ai-*` card with the Latin `AI` pill, a wrapping note, a 11px confidence line, and an actions row holding a raised **Apply** and a quiet **Dismiss** |
| `needs_triage` | An unstyled `.classification-chip-triage` that renders identically to the two neutral chips above it | An amber `--prio-high-*` pill, visually distinct from the neutral category/channel chips, inside the same AI card |
| Chat citations | A default browser bulleted list of blue-ish links under the answer | A rule-separated, labelled, wrapping row of bordered chips |
| Focus | Browser default (removed on some UAs) | An explicit `:focus-visible` outline on all three interactive elements |
| Dark / RTL | Inherited by accident | Guaranteed structurally: zero new tokens, zero physical properties |

---

## Decisions

**Decision 1 — `classification-ai*` goes in `web/src/index.css`; `portal-chat-citations*` goes in
`web/src/features/portal/portal.css`. Nothing moves.**
The issue's Scope line says *"`web/src/index.css` currently holds the class refs — move to the
right feature stylesheet if that is the repo pattern."* That premise is false and must not be
acted on: `grep -rn "classification-ai\|portal-chat-citation" web/src/index.css` returns **zero**
hits. All ten current references are in the two `.tsx` files. This story only **adds** rules.
Where they go is settled by the existing pattern, not invented: `find web/src -name "*.css"`
returns exactly four files — `index.css`, `features/portal/portal.css`,
`features/channels/channels.css`, `features/csat/csat.css`. **The tickets feature has no
stylesheet**, and every thread/meta-panel rule — `.classification-chips`, `.classification-chip`,
the entire `.assist-*` family — already lives in `index.css`. Creating
`web/src/features/tickets/tickets.css` would be the deviation. The portal, by contrast, *does*
have one, and `PortalLayout.tsx:5` already imports it. **No new file is created and no `import`
statement is added anywhere in this story.**

**Decision 2 — zero new custom properties, therefore zero edits to the four theme blocks.**
Every value the two surfaces need already exists in all four blocks (`:43`, `:195`, `:321`,
`:442`): `--ai-card-bg`, `--ai-card-border`, `--ai-body-fg`, `--ai-action-fg`, `--prio-high-bg`,
`--prio-high-fg`, `--bg-card`, `--border-card`, `--text-muted`, `--btn-bg`, `--nav-active-fg`. This
is the whole of the dark-theme work: a token that is already defined four times cannot drift, so
Done Criterion 3's dark half is discharged by *not writing* a declaration rather than by writing a
second palette. It also makes Done Criterion 2 trivially true. **If you find yourself wanting a new
token, you have left the story.**

**Decision 3 — the `AI` pill is `.assist-chip`, reused verbatim, with `dir="ltr"`.**
WIS-18 Decision 6 and the `.assist-*` header comment both require that every AI-produced surface
carries the same violet card and the same two-character Latin badge, so an agent never mistakes a
model suggestion for a colleague's. Reusing the class rather than cloning it means the badge cannot
diverge later. `"AI"` is allowlisted in `web/scripts/i18n-allowlist.json`, so `npm run i18n:check`
passes with **no allowlist edit**. `dir="ltr"` is explicit rather than incidental: it pins the two
Latin characters against a future title that begins with a strong-RTL run.

**Decision 4 — Apply is a raised `--bg-card` button, NOT a copy of `.assist-use-btn`.**
The obvious move is to reuse `.assist-use-btn` (`index.css:2604-2613`), a solid `--ai-chip-bg`
fill with `--ai-chip-fg` text. Computed from the WCAG relative-luminance formula, that pair is
`#FFFFFF` on `#7C3AED` = **5.70:1** in light but `#FFFFFF` on `#8B5CF6` = **4.24:1** in dark — below
the 4.5:1 AA minimum for a 12px/700 label, which would only pass as "large text" at ≥ 18.66px or
≥ 14px bold. Copying it would put a **new** interactive element in this story's diff that fails
Done Criterion 4. Instead Apply is `--ai-action-fg` on `--bg-card` with an `--ai-card-border` edge:
`#7C3AED` on `#FFFFFF` = **5.70:1** light, `#C4B5FD` on `#1C1D24` = **8.49:1** dark. Dismiss is the
same ink on the card itself: `#7C3AED` on `#F5F3FF` = **5.19:1** light, `#C4B5FD` on the dark card
composite `≈ #2F2C42` = **7.25:1** dark. Both pass in both themes, and Apply still reads as the
primary of the two through elevation and weight rather than through a colour that fails.

**Decision 5 — the existing `.assist-chip` shortfall is recorded, not fixed.**
The same 4.24:1 measurement applies to `.assist-chip` itself in dark theme, and this story reuses
that class. Raising it means editing `--ai-chip-bg` in two theme blocks, which repaints every
surface WIS-18 shipped — a WIS-18-owned change, out of scope here, and explicitly listed under
**Deliberate deferrals** in `00-overview.md`. **A `wisal-ui-review` finding about `.assist-chip` is
not a blocking finding for this story**, because this story adds no rule for it. Do not "fix" it.

**Decision 6 — inside the classification card, secondary text is de-emphasised by size only.**
`--text-muted` `#64748B` on `--ai-card-bg` `#F5F3FF` computes to **4.34:1** — it **fails** AA. The
muted grey that is correct everywhere else in this app is wrong on the violet card. The confidence
line therefore keeps `--ai-body-fg` (`#4C1D95` on `#F5F3FF` = **9.99:1**) and drops from 12px to
11px. `opacity` is equally forbidden: it lowers the effective contrast by exactly the same
mechanism.

**Decision 7 — the new portal rules carry no `var(--token, #fallback)` fallbacks, deliberately
breaking that file's local habit.**
`portal.css` writes `var(--bg-page, #f1f5f9)` throughout. A fallback *is* a hex, and Done Criterion
2 requires a hex/rgb grep over the new rules to return nothing. Dropping them is safe and provably
so: `web/src/main.tsx:3` imports `index.css` globally, so every `:root` token is on the document
that renders the portal — the portal is a route inside the same SPA, not a separate document. Say
so in the block's header comment so the next reader does not "restore" the fallbacks.

**Decision 8 — citations render as chips on `--bg-card`, not as bullets on the bubble.**
The issue asks for wrapping and hover/focus, which a `<ul>` of default bullets serves badly at four
items. The chips sit on `--bg-card`, one step of elevation above the agent bubble's `--bg-page` —
`brief.md:124`'s rule for dark theme (*"layer separation via background-color shift, not shadow"*)
applied in both themes. It also buys contrast: the link colour on `--bg-card` is **6.29:1** light /
**5.63:1** dark, versus 6.01:1 / lower on the bubble ground. The semantic `<ul>`/`<li>` structure is
kept — only `list-style` and the layout change.

**Decision 9 — every rule uses logical properties, so there is not one `[dir="rtl"]` selector in
this story.** `margin-block-start`, `padding-block-start`, `border-block-start`, `max-inline-size`,
flex `gap`. Both files already state this as their contract (`portal.css:1`,
`index.css:2554-2556`). The only genuine RTL hazard is **content**, not layout: `kb_articles` has
no `locale` column (WIS-23's own recorded finding), so a citation title can be English while the
UI is Arabic. `dir="auto"` on the citation link is the fix, and it is the one RTL-motivated markup
change in the story.

---

## Backend Tasks

**No backend changes required.** Nothing under `api/` is touched. If your diff contains an `api/`
path, you have left the story.

---

## Frontend Tasks

### 1 — Add the classification rule block to `web/src/index.css`

**File: `web/src/index.css`**

Insert **after** `.assist-skeleton-actions` (currently line `2657`) and **before**
`.tq-subject-link` (currently line `2659`) — i.e. into the blank line at `2658`, so the new block
closes the AI-Assist section it belongs to. Do not append at the end of the file; the section
comment at `:2550` is what makes the placement legible.

```css
/* ---- AI classification suggestion (Story 27 / WIS-28) ---------------------
   ClassificationCard.tsx renders inside .meta-panel — a 300px column with
   20px padding (:2417-2426), i.e. a 260px content box — so the card must
   wrap, never overflow. It lives here rather than in a feature stylesheet
   because the tickets feature has none: .classification-chip (:2508) and the
   whole .assist-* family above are in this file too.

   This block declares NO custom property. Every colour is an --ai-* or
   --prio-* token already defined in all four theme blocks (:43, :195, :321,
   :442), which is what makes dark theme automatic rather than a second
   palette. All sizing is logical, so RTL mirrors with no direction-specific
   rule — the same contract the .assist-* comment above states.

   Two contrast facts, computed from the WCAG relative-luminance formula and
   NOT to be "simplified" later:
   - --text-muted on --ai-card-bg is 4.34:1 and FAILS AA. The confidence line
     stays --ai-body-fg (9.99:1) and is de-emphasised by size alone.
   - Apply must not reuse .assist-use-btn's solid --ai-chip-bg fill: white on
     the dark --ai-chip-bg is 4.24:1. The raised --bg-card treatment below is
     5.70:1 light / 8.49:1 dark.
   ------------------------------------------------------------------------ */

.classification-ai {
  margin-block-start: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  background: var(--ai-card-bg);
  border: 1px solid var(--ai-card-border);
  border-radius: 8px;
  padding: 10px 12px;
}

.classification-ai-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.classification-ai-note {
  font-size: 12px;
  line-height: 1.55;
  color: var(--ai-body-fg);
  /* A long localised category label must wrap inside 260px, not overflow. */
  overflow-wrap: anywhere;
}
.classification-ai-note--meta { font-size: 11px; }

.classification-ai-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.classification-ai-btn {
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 5px 8px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--ai-action-fg);
  cursor: pointer;
}
.classification-ai-btn--apply {
  background: var(--bg-card);
  border: 1px solid var(--ai-card-border);
  font-weight: 700;
}
.classification-ai-btn:hover:not(:disabled) { text-decoration: underline; }
.classification-ai-btn:disabled { opacity: 0.55; cursor: not-allowed; text-decoration: none; }
.classification-ai-btn:focus-visible { outline: 2px solid var(--nav-active-fg); outline-offset: 2px; }

.classification-chip-triage { background: var(--prio-high-bg); color: var(--prio-high-fg); }
```

`transparent` and `anywhere` are CSS keywords, not colour literals — the hex/rgb grep in Task 7
does not match them.

---

### 2 — Rewrite the two branches of `ClassificationCard.tsx` (markup only)

**File: `web/src/features/tickets/components/thread/ClassificationCard.tsx`**

Change **only** what is listed. Imports, the `useT` call, both mutation hooks, `hasSuggestion`,
`differs`, both `onClick` bodies, both `disabled` expressions, every `t(...)` key and both
`role="status"` attributes stay byte-identical.

Replace the `needs_triage` block (currently `:37-52`) with:

```tsx
      {ai && ai.needs_triage && !hasSuggestion && (
        <div className="classification-ai" role="status">
          <div className="classification-ai-head">
            <span className="assist-chip" dir="ltr">AI</span>
            <span className="classification-chip classification-chip-triage">
              {t('classification.needsTriage')}
            </span>
          </div>
          <p className="classification-ai-note">{t('classification.notConfident')}</p>
          <div className="classification-ai-actions">
            <button
              type="button"
              className="classification-ai-btn"
              onClick={() => dismiss.mutate()}
              disabled={dismiss.isPending}
            >
              {t('classification.dismiss')}
            </button>
          </div>
        </div>
      )}
```

Replace the `differs` block (currently `:54-89`) with:

```tsx
      {differs && ai && (
        <div className="classification-ai" role="status">
          <span className="assist-chip" dir="ltr">AI</span>
          <p className="classification-ai-note">
            {t('classification.suggested', {
              category: ai.suggested_category_label,
              priority: ai.suggested_priority_label,
            })}
          </p>
          {ai.confidence !== null && (
            <p className="classification-ai-note classification-ai-note--meta">
              {t('classification.confidence', { percent: Math.round(ai.confidence * 100) })}
            </p>
          )}
          <div className="classification-ai-actions">
            <button
              type="button"
              className="classification-ai-btn classification-ai-btn--apply"
              onClick={() =>
                apply.mutate({
                  category: ai.suggested_category!,
                  priority: ai.suggested_priority!,
                })
              }
              disabled={apply.isPending}
            >
              {apply.isPending ? t('classification.applying') : t('classification.apply')}
            </button>
            <button
              type="button"
              className="classification-ai-btn"
              onClick={() => dismiss.mutate()}
              disabled={dismiss.isPending}
            >
              {t('classification.dismiss')}
            </button>
          </div>
        </div>
      )}
```

Note the asymmetry and keep it: the `differs` branch puts the `AI` pill directly in the column flex
(`align-items: flex-start` places it at the inline start and mirrors in RTL for free), because it
has nothing to sit beside. Only the triage branch needs `.classification-ai-head`, to hold the pill
and the amber `Needs triage` pill on one row.

Extend the file's existing docblock (`:8-17`) with one line — do not rewrite it:

```
 * Story 27 (WIS-28) styles this card; the render conditions above are frozen.
```

---

### 3 — Add the citation rule block to `web/src/features/portal/portal.css`

**File: `web/src/features/portal/portal.css`**

Append at the **end of the file** (currently 449 lines, ending with the `.portal-prose a` rule).
The chat screen is one of the Decision-3 "undesigned screens" whose section starts at `:313`, and
this block continues it.

```css
/* --- Chatbot KB citations (Story 27 / WIS-28) ------------------------------
   Rendered by ChatCitations.tsx INSIDE .portal-message-agent (:298-301), so
   every contrast pair here is computed against that bubble, not against the
   page: the chips lift one step onto --bg-card, giving 6.29:1 light and
   5.63:1 dark for the --portal-link ink they carry.

   Unlike the rest of this file these rules carry NO var(--token, #fallback)
   fallback. WIS-28's Done Criterion 2 requires that a hex/rgb grep over the
   new rules return nothing, and a fallback is a hex. It is safe: main.tsx:3
   imports index.css globally, so every :root token is present on the document
   that renders the portal. Do not "restore" the fallbacks.

   Logical properties only, per this file's line 1 — RTL mirrors for free. */

.portal-chat-citations {
  margin-block-start: 8px;
  padding-block-start: 8px;
  border-block-start: 1px solid var(--border-card);
}

.portal-chat-citations-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-block-end: 6px;
}

.portal-chat-citations-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.portal-chat-citation-link {
  display: inline-block;
  max-inline-size: 100%;
  background-color: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  line-height: 1.5;
  /* A long article title must wrap inside the bubble, not widen it. */
  overflow-wrap: anywhere;
}

.portal-chat-citation-link:hover {
  border-color: var(--btn-bg);
  text-decoration: underline;
}

.portal-chat-citation-link:focus-visible {
  outline: 2px solid var(--btn-bg);
  outline-offset: 2px;
}
```

**Do not set `color` here.** The element keeps `.portal-link` (`:169-179`), which supplies the ink,
`font-weight: 600` and `text-decoration: none`. Both are single-class selectors, so specificity
ties and source order decides: this block is later in the file, so its `font-size: 12px` wins over
`.portal-link`'s `font-size: inherit`, which is the intent.

---

### 4 — Add the two class names and `dir="auto"` in `ChatCitations.tsx` (markup only)

**File: `web/src/features/portal/components/ChatCitations.tsx`**

The `citations.length === 0` early return at `:13` is **frozen** — it is this surface's Empty
state. Change only the JSX at `:15-28`:

```tsx
  return (
    <div className="portal-chat-citations">
      <p className="portal-chat-citations-label">{t('chat.sources')}</p>
      <ul className="portal-chat-citations-list">
        {citations.map((c) => (
          <li key={c.id}>
            <Link
              className="portal-link portal-chat-citation-link"
              to={`/portal/faq/${c.slug}`}
              dir="auto"
            >
              {c.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
```

`dir="auto"` is load-bearing, not decoration: `kb_articles` has no `locale` column, so an English
title inside an Arabic UI would otherwise have its trailing punctuation flipped to the wrong edge.

Add one line to the existing docblock (`:6-9`):

```
 * Story 27 (WIS-28) styles this list; the empty-array early return is frozen.
```

---

### 5 — Extend `ClassificationCard.test.tsx`

**File: `web/src/features/tickets/components/thread/ClassificationCard.test.tsx`**

**Every one of the five existing tests stays, unedited.** Append three new `it(...)` blocks inside
the existing `describe('ClassificationCard', …)`. Match the file's existing style: `makeTicket` and
`renderWithProviders` from `./testUtils`, the `classification()` helper already defined at `:19-31`.

jsdom loads no stylesheet, so **do not** assert `getComputedStyle`. Assert the structure the CSS
hooks onto instead — that is what actually regresses if someone edits the JSX.

```tsx
  it('wraps the suggestion in the AI card with the Latin AI pill and an actions row', () => {
    const { container } = renderWithProviders(
      <ClassificationCard
        ticket={makeTicket({ category: 'technical', priority: 'high', ai_classification: classification() })}
      />
    );

    const card = screen.getByRole('status');
    expect(card).toHaveClass('classification-ai');

    const pill = container.querySelector('.assist-chip');
    expect(pill).toHaveTextContent('AI');
    expect(pill).toHaveAttribute('dir', 'ltr');

    expect(container.querySelector('.classification-ai-actions')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveClass('classification-ai-btn--apply');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass('classification-ai-btn');
    expect(container.querySelector('.classification-ai-note--meta')).toHaveTextContent('92% confident');
  });

  it('puts the needs-triage pill and the AI pill on one head row', () => {
    const { container } = renderWithProviders(
      <ClassificationCard
        ticket={makeTicket({
          ai_classification: classification({
            suggested_category: null,
            suggested_category_label: null,
            suggested_priority: null,
            suggested_priority_label: null,
            confidence: 0.2,
            needs_triage: true,
          }),
        })}
      />
    );

    const head = container.querySelector('.classification-ai-head');
    expect(head).not.toBeNull();
    expect(head!.querySelector('.assist-chip')).toHaveTextContent('AI');
    expect(head!.querySelector('.classification-chip-triage')).toHaveTextContent('Needs triage');
  });

  it('renders no AI card at all when there is nothing to suggest', () => {
    const { container } = renderWithProviders(
      <ClassificationCard ticket={makeTicket({ ai_classification: null })} />
    );

    expect(container.querySelector('.classification-ai')).toBeNull();
    expect(container.querySelector('.assist-chip')).toBeNull();
  });
```

The third test is the one that catches the most likely regression: an `AI` pill hoisted out of both
conditional branches would light up on every ticket that was never classified.

---

### 6 — Create `ChatCitations.test.tsx`

**Create file: `web/src/features/portal/components/ChatCitations.test.tsx`**

There is no test for this component today. `ChatCitations` renders a react-router `<Link>` and
calls `useT('portal')`, so it needs both a router and the i18n provider. **Use the existing
harness** — `renderPortal` from `web/src/features/portal/testUtils.tsx:15-40`, which already wraps
children in `QueryClientProvider` → `UiPreferencesProvider` → `I18nextProvider` → `MemoryRouter`.
Do **not** introduce a second routing helper or import `MemoryRouter` directly; every other portal
test goes through `renderPortal` (see `PortalChatPage.test.tsx:7`).

`ChatCitation` is `{ id: number; slug: string; title: string }`
(`web/src/features/portal/model/portalChat.ts:6`).

```tsx
import { screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChatCitations } from './ChatCitations';
import { renderPortal } from '../testUtils';
import type { ChatCitation } from '../model/portalChat';

function cite(n: number): ChatCitation {
  return { id: n, slug: `article-${n}`, title: `Help article ${n}` };
}

describe('ChatCitations', () => {
  it('renders nothing for an empty citation array', () => {
    const { container } = renderPortal(<ChatCitations citations={[]} />);

    expect(container.querySelector('.portal-chat-citations')).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('renders a labelled chip list, one link per citation, pointing at the public FAQ route', () => {
    const { container } = renderPortal(
      <ChatCitations citations={[cite(1), cite(2), cite(3), cite(4)]} />
    );

    expect(container.querySelector('.portal-chat-citations')).not.toBeNull();
    expect(screen.getByText('Sources')).toHaveClass('portal-chat-citations-label');

    const list = container.querySelector('.portal-chat-citations-list') as HTMLElement;
    expect(within(list).getAllByRole('link')).toHaveLength(4);

    const first = screen.getByRole('link', { name: 'Help article 1' });
    expect(first).toHaveAttribute('href', '/portal/faq/article-1');
    expect(first).toHaveClass('portal-link');
    expect(first).toHaveClass('portal-chat-citation-link');
    expect(first).toHaveAttribute('dir', 'auto');
  });
});
```

`'Sources'` is the English value of `portal.chat.sources`
(`web/src/i18n/locales/en/portal.json:120`), and `renderPortal` mounts the real `i18n` instance,
which the suite runs in English. That is the same way `PortalChatPage.test.tsx` asserts translated
strings — do not add a mock.

---

### 7 — Self-verify the two new blocks before running anything

Run these four greps from `web/`. Each must return **nothing**. They are the mechanical half of
Done Criteria 2, 3 and 4, and they are cheaper than a review round.

```bash
# 1. No colour literal in either new block (Done Criterion 2).
git diff -U0 -- src/index.css src/features/portal/portal.css | grep -E "^\+" | grep -Ei "#[0-9a-f]{3,8}\b|rgba?\("

# 2. No physical property or physical value anywhere in the diff (Done Criterion 3, RTL half).
git diff -U0 | grep -E "^\+" | grep -E "\b(margin|padding|border|inset)-(left|right)\b|\b(left|right):|text-align: *(left|right)"

# 3. No new custom property declared (Decision 2).
git diff -U0 -- src/index.css src/features/portal/portal.css | grep -E "^\+\s*--[a-z]"

# 4. No token used that is not already defined — every var() in the diff must
#    appear at least four times in index.css (once per theme block) or resolve
#    from one that does.
git diff -U0 | grep -oE "var\(--[a-z0-9-]+\)" | sort -u
#    …then for each: grep -c "  --<name>:" src/index.css   → expect 4
```

`--btn-bg`, `--nav-active-fg` and `--brand-primary` resolve through `--brand-primary` and will
report their own counts; that is expected and correct.

---

## Edge Cases & Failure Modes

- **A long localised category label** (Arabic `طلب ميزة جديدة` inside `classification.suggested`)
  in a 260px meta panel. `.classification-ai-note`'s `overflow-wrap: anywhere` plus the column flex
  wraps it. Without that declaration the card pushes a horizontal scrollbar onto `.meta-panel`,
  which is `overflow-y: auto` only (`index.css:2421`).
- **Apply and Dismiss cannot fit on one 260px row** (Arabic `تطبيق` + `تجاهل` are short, but
  `جارٍ التطبيق…` is not). `.classification-ai-actions` is `flex-wrap: wrap`, so Dismiss drops to a
  second line rather than overflowing. Verified by the width, not assumed.
- **`apply.isPending` is true.** The label swaps to `classification.applying` — an existing
  behaviour — and `.classification-ai-btn:disabled` drops opacity to 0.55 and suppresses the hover
  underline. The button keeps its box, so the card does not reflow mid-click.
- **`dismiss.isPending` is true and there is no pending label** (WIS-23 shipped no
  `classification.dismissing` key, and this story adds no key). The `:disabled` rule is the only
  signal. That is accepted: the mutation invalidates and the card unmounts almost immediately.
- **`ai.confidence` is `null` but a suggestion exists.** The `{ai.confidence !== null && …}` guard
  at `:62` drops the 11px line; `gap: 8px` closes up with no empty-element artefact, because the
  element is not rendered at all rather than rendered empty.
- **The suggestion matches the live values.** `differs` is false and `needs_triage` is false, so
  **neither** block renders and the `section` is just the two neutral chips — exactly as today.
  Test 3 in Task 5 pins that no `.classification-ai` or `.assist-chip` leaks out.
- **Four citations, or one very long title.** `.portal-chat-citations-list` wraps at `gap: 6px`;
  `.portal-chat-citation-link` is `max-inline-size: 100%` with `overflow-wrap: anywhere`, so a
  single 90-character title becomes a multi-line chip inside the bubble rather than widening
  `.portal-message`, which is capped at `max-width: 80%` (`portal.css:286-290`).
- **Zero citations on an assistant answer** (the refusal path, and any ungrounded answer).
  `ChatCitations.tsx:13` returns `null`, so no divider and no label render. The bubble looks like a
  plain answer. **This is the correct Empty state; do not add an "no sources" message** — that
  would need a new i18n key, which is out of scope.
- **A citation title in English inside an Arabic UI.** `kb_articles` has no `locale` column
  (WIS-23's recorded finding), so this is normal, not exceptional. `dir="auto"` on the `Link`
  resolves each title independently from its own first strong character.
- **Dark theme reached three different ways** — OS preference with no explicit choice
  (`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`, `index.css:194-195`), an
  explicit dark choice (`:root[data-theme="dark"]`, `:321`), and an explicit light choice
  overriding a dark OS (`:root[data-theme="light"]`, `:442`). Because Decision 2 adds no token,
  all three are covered by construction. **Do not add a fourth block.**
- **Someone later adds a `var(--x, #fallback)` back into the portal block** because the rest of the
  file has them. The header comment in Task 3 exists to stop that; grep 1 in Task 7 catches it.
- **`.portal-link` and `.portal-chat-citation-link` disagree on `font-size`.** They are both
  single-class selectors, so the later one in the file wins. If the new block is ever moved above
  `:169`, the chips silently inherit the bubble's font size. Keep it at the end of the file.
- **The `AI` literal trips `npm run i18n:check`.** It will not: `"AI"` is in
  `web/scripts/i18n-allowlist.json` `literals` with WIS-18 Decision 6 as the reason. If the check
  fails on it, the allowlist has been edited by something else — investigate that, **do not add a
  second entry**.
- **A known, accepted, out-of-scope failure.** `.assist-chip` in dark theme is `#FFFFFF` on
  `#8B5CF6` = **4.24:1**, below AA for its 10px/700 size. This story reuses the class and does not
  change it (Decision 5). It is recorded as a deferral in `00-overview.md` and must not block this
  story's review.

---

## Test Plan

Unit tests only; there is no integration surface and no backend change.

1. **`web/src/features/tickets/components/thread/ClassificationCard.test.tsx`** — *extend, five
   existing tests unedited.* Add: (a) the suggestion branch wraps in `.classification-ai`, carries
   an `.assist-chip` reading `AI` with `dir="ltr"`, has a `.classification-ai-actions` row, Apply
   carries `classification-ai-btn--apply`, Dismiss carries `classification-ai-btn`, and the
   confidence line carries `classification-ai-note--meta`.
2. **Same file** — (b) the `needs_triage` branch puts the `AI` pill and the
   `.classification-chip-triage` pill inside one `.classification-ai-head`.
3. **Same file** — (c) with `ai_classification: null`, neither `.classification-ai` nor
   `.assist-chip` is in the DOM. This is the regression guard for hoisting the pill out of the
   conditionals.
4. **`web/src/features/portal/components/ChatCitations.test.tsx`** — *new file.* (a) an empty array
   renders an empty container.
5. **Same file** — (b) four citations render `.portal-chat-citations`, a
   `.portal-chat-citations-label` reading the `chat.sources` string, a `.portal-chat-citations-list`
   holding four links, and a first link with `href="/portal/faq/article-1"`, both classes, and
   `dir="auto"`.
6. **No test asserts a computed style.** jsdom loads no stylesheet; `getComputedStyle` returns UA
   defaults, so such an assertion would be either vacuous or false. The CSS is gated by the Task 7
   greps and by `npm run build`, which parses both stylesheets through Vite.
7. **Regression:** the whole suite. `web/src/features/tickets/components/thread/TicketMetaPanel.test.tsx`
   mounts `ClassificationCard` transitively and must still pass untouched; so must
   `web/src/features/portal/pages/PortalChatPage.test.tsx`, which renders `ChatBubble` →
   `ChatCitations`. **If either needs editing, your markup change went too far.**
8. **`web/src/i18n/catalogueParity.test.ts`** must pass with **zero** catalogue edits. It is the
   proof that no new string was invented.

---

## Verification Steps

1. **Frontend tests:** `cd web && npx vitest run` — expect **≥ 628 pass** across **102 files**
   (the Round-1 baseline is 623 / 101; this story adds 5 tests in 1 new file). Zero failures.
2. **Frontend build:** `cd web && npm run build` — runs `tsc -b` then `vite build`. Exit 0. This is
   the only step that actually parses the two new CSS blocks; a stray brace fails here and nowhere
   else.
3. **Frontend lint:** `cd web && npm run lint` — `oxlint` then `node scripts/check-no-literals.mjs`.
   Clean apart from the pre-existing warnings Round 1 recorded; **no new warning in a touched
   file**, and `i18n:check` clean across all 19 enforced roots.
4. **Done Criterion 1 — nothing renders unstyled.** For each of the seven class names, prove a rule
   exists:
   ```bash
   cd web
   for c in classification-ai classification-ai-note classification-ai-btn \
            classification-chip-triage portal-chat-citations portal-chat-citations-label \
            portal-chat-citations-list portal-chat-citation-link classification-ai-head \
            classification-ai-actions; do
     printf '%-32s %s\n' "$c" "$(grep -rc "\.$c" src/index.css src/features/portal/portal.css | paste -sd/ -)"; done
   ```
   Every name must show a non-zero count in exactly one of the two files.
5. **Done Criterion 2 — tokens only.** Run grep 1 from Task 7. It must print nothing.
6. **Done Criterion 3 — dark + RTL, structurally.** Run greps 2, 3 and 4 from Task 7. Then confirm
   the token count: every `var(--x)` in the diff resolves to a name declared **four** times in
   `src/index.css`. Record the list and the counts in the commit message — that list *is* the
   dark-theme evidence, in place of a screenshot.
7. **Done Criterion 4 — focus and contrast.** `grep -n "focus-visible" src/index.css | tail -5` and
   `grep -n "focus-visible" src/features/portal/portal.css` must each show the new rule. Restate
   the six computed ratios from Decision 4, Decision 6 and Decision 8 in the commit message; they
   are computed values, not estimates, and a reviewer must be able to check them without a browser.
8. **Done Criterion 6 — run the `wisal-ui-review` skill** against
   `web/src/features/tickets/components/thread/ClassificationCard.tsx`,
   `web/src/features/portal/components/ChatCitations.tsx` and the two new CSS blocks. Fix anything
   it raises **about a rule this story adds**. A finding about `.assist-chip`'s dark-theme
   4.24:1, about `ChatBubble`'s inline styles, or about `.portal-message-customer`'s hardcoded
   `#fff` is **pre-existing and out of scope** — record it in the commit message as a deferral and
   move on (Decision 5).
9. **Scope check:** `git diff --name-only` must list **exactly six** paths — `web/src/index.css`,
   `web/src/features/portal/portal.css`,
   `web/src/features/tickets/components/thread/ClassificationCard.tsx`,
   `web/src/features/tickets/components/thread/ClassificationCard.test.tsx`,
   `web/src/features/portal/components/ChatCitations.tsx`,
   `web/src/features/portal/components/ChatCitations.test.tsx` — plus the `.squad/` files. **Zero**
   `api/` paths, **zero** `.json` catalogue paths, **zero** `package.json` change.
10. **Backend regression is not required** and must not be claimed: nothing under `api/` changed.
    Do not run `php artisan test` and do not report a backend number.

---

## Done Criteria

Copied verbatim from WIS-28.

- [ ] Every new class name has a rule; nothing renders unstyled.
- [ ] Tokens only — `grep` for hex/rgb in the new rules returns nothing.
- [ ] Correct in dark theme and in Arabic RTL (screenshot or explicit structural check).
- [ ] Focus visible on every interactive element; contrast computed, not assumed.
- [ ] `npm run test` + `npm run build` + `npm run lint` green.
- [ ] `wisal-ui-review` skill run against both surfaces with no blocking findings.

All six are dischargeable in this repository with no browser, no external account and no live key.
Criterion 3's parenthetical explicitly permits the structural check, which is what Verification
Step 6 performs.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 28 (WIS-29).**
