# ai-surface-styling — plan overview

Entry point for the **ai-surface-styling** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 27 | [27-story-ai-surface-styling.md](27-story-ai-surface-styling.md) | Style the WIS-23 AI Surfaces — Classification Card & Chat Citations | WIS-28 | Stories 24, 19, 17, 04 |

## Dependency notes

**This is a finishing story, not a feature story.** WIS-23 (Story 24) shipped auto-classification
and the portal chatbot working and tested, but shipped `ClassificationCard.tsx` and
`ChatCitations.tsx` with **zero CSS rules** for their class names — a gap its own plan-review
recorded as a non-blocking cosmetic deviation. Story 27 closes exactly that gap and nothing else:
two CSS blocks, two markup diffs, one new test file. Planned at **full** depth; every path, line
number, token name and contrast ratio was verified against real code at plan time.

- **Depends on** [`../ai-customer-intelligence/24-story-ai-customer-intelligence.md`](../ai-customer-intelligence/24-story-ai-customer-intelligence.md)
  — owns both components and all seven unstyled class names. Every WIS-23 decision still binds; no
  render condition, prop, hook or endpoint changes here.
- **Depends on** [`../ai-assist-panel/19-story-ai-assist-panel.md`](../ai-assist-panel/19-story-ai-assist-panel.md)
  — owns the `--ai-*` token family and the `.assist-*` rules the classification card rhymes with,
  and **Decision 6** (the `AI` badge stays Latin in Arabic; `"AI"` is already allowlisted).
- **Depends on** [`../customer-portal/17-story-customer-portal.md`](../customer-portal/17-story-customer-portal.md)
  — owns `web/src/features/portal/portal.css`, its logical-properties-only contract, and its
  Decision 3 "undesigned screens" section, which the citation block continues.
- **Depends on** [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md)
  — owns `.classification-chip` and the amber `--prio-high-*` `badge_text_on_tint` pair the
  `needs_triage` pill reuses.
- **Blocks nothing.** It is a leaf, and the first story of Round 2.

**Contracts this story establishes:**

- **`classification-ai*` lives in `web/src/index.css`; `portal-chat-citations*` lives in
  `web/src/features/portal/portal.css`.** The tickets feature has no stylesheet, and creating one
  would be the deviation, not the convention. Nothing was moved out of `index.css` — the class
  names never appeared there.
- **Neither surface declares a design token.** Every colour resolves to an `--ai-*`, `--prio-*` or
  base token already defined in all four theme blocks (`index.css:43`, `:195`, `:321`, `:442`).
  Dark theme is therefore correct by construction, and a later story that adds a rule to either
  block must keep that property.
- **The AI badge is `.assist-chip`, reused — never cloned.** Any third AI surface reuses the same
  class so the badge cannot diverge.
- **Inside the classification card, `--text-muted` is forbidden.** It computes to 4.34:1 on
  `--ai-card-bg` and fails AA. Secondary text there is `--ai-body-fg` at a smaller size.
- **The new portal rules carry no `var(--token, #fallback)` fallbacks**, deliberately, because a
  fallback is a hex literal and the story's Done Criterion 2 forbids one. `main.tsx:3` loads
  `index.css` globally, so the tokens are always present.

## Deliberate deferrals

Recorded here so a later story picks them up instead of this one growing:

- **`.assist-chip`'s dark-theme contrast.** `--ai-chip-fg` `#FFFFFF` on the dark `--ai-chip-bg`
  `#8B5CF6` computes to **4.24:1**, below the 4.5:1 AA minimum for its 10px/700 size. Fixing it
  means editing `--ai-chip-bg` in two theme blocks, which repaints every surface WIS-18 shipped.
  It is a **WIS-18-owned token change** and belongs in its own story.
- **`ChatBubble.tsx`'s three inline `style` objects** (`:16`, `:19`, `:23`) and
  `.portal-message-customer`'s hardcoded `#fff` (`portal.css:292-296`). Pre-existing; restyling
  surfaces WIS-23 left *styled* is out of scope.
- **Extracting `web/src/features/tickets/tickets.css`** out of the 4,535-line `index.css`. A real
  piece of work and a separate story; doing a slice of it here would leave the file half-migrated.
- **A `needs_triage` chip in the agent queue's FilterBar** — still deferred from WIS-23. This story
  styles the pill in the thread, not a queue filter.
- **Automated contrast checking in CI.** `docs/design/brief.md:127-132` asks for it. This story
  computes its ratios by hand and records them in the plan; wiring a checker into `npm run lint` is
  a separate, repo-wide change.
