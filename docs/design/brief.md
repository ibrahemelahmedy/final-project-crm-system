# Design Brief — Wisal Helpdesk Design System

**Reoriented 2026-08-22.** This brief originally targeted a Sales CRM
(Leads/Opportunities/Pipeline). The client's actual requirement, captured
verbatim in `../requirements/client-requirements-raw.md`, is a **Customer
Support / Helpdesk CRM** — ticket-centric, built around agents resolving
customer issues against SLAs, comparable to Zendesk, Freshdesk, or Intercom.
This version supersedes the sales-CRM framing throughout. The underlying
tokens (color, type, spacing) do not change — they were never sales-specific —
only the competitive analysis, modules, and layout patterns below do.

This is the input document for design tooling (Stitch for divergent exploration,
Claude Design for committed execution). It exists so that a design decision is
traceable to a reason — either a competitor pattern with a stated justification,
or a project requirement — never to "it looked right."

## Competitive analysis

Researched 2026-08-22, replacing the earlier Sales-CRM comparison. Each entry
states what the platform does well, and — where the source names one — what to
avoid about it. A pattern is only worth copying when the reason it works is
understood; otherwise it is decoration.

| Platform | Strength observed | What we take | What we avoid |
|---|---|---|---|
| **Freshdesk** | Threaded conversations organized clearly; complete visibility into ticket history so agents resolve with full context; positioned as intuitive and low admin-overhead | The **Conversation Thread** pattern as the universal view for a ticket, regardless of which channel it came from — full history in one place, not fragmented by channel | Its simplicity can mean fewer power-user tools for complex routing — acceptable trade-off for our scope, not a defect to inherit blindly |
| **Zendesk** | Strict omnichannel queues; enterprise-grade; deepest compliance and integrations; ticket-centric interface | The **Ticket Queue** as a structured list — sortable/filterable by priority, status, SLA state, and assigned agent — not a loose inbox | Its interface is explicitly called dated/heavy next to Intercom's — enterprise density is not our target; we keep Zendesk's structure, not its visual weight |
| **Intercom** | Conversational-first, real-time messaging, modern UI, AI-first — "significantly more modern than Zendesk's ticket-centric interface" per the same comparison | Modern conversational visual language for the thread view; AI-assist surfaced inline (suggested replies) rather than in a separate panel | A pure conversational model can blur ticket boundaries (state, ownership, SLA) — we keep explicit ticket state even inside a modern thread UI |
| **Industry SLA/priority consensus** (Jitbit, Hiver, Capacity guides) | Priority tiers (commonly Critical/High/Normal/Low, or P1–P4) each carry explicit response/resolution time targets; supervisors get real-time visibility into priority + SLA risk + handle time together, not as separate views | A dedicated **priority** token set (distinct from status), and an **SLA-risk indicator** shown alongside priority everywhere a ticket appears — list, card, or thread header | Do not conflate "priority" and "status" into one badge — they answer different questions (how urgent vs. where it is in the workflow) and conflating them is a common, confusing shortcut |
| **2026 data-table consensus** (Stripe Dashboard, GitHub Issues cited as reference-grade) | Server-side pagination, faceted filters, filter state in the URL, column visibility/reorder, bulk-action bar on row selection | Adopted wholesale for Customers and Knowledge Base article lists | — |
| **2026 dashboard consensus** (Linear, Notion cited) | Whitespace and calm layout outperform data-dense screens for daily-use tools; progressive disclosure | Agent Dashboard shows a small number of decisions (my queue, SLA at risk), not every available metric | Dense "everything visible" layouts |

Sources: [Freshdesk vs Intercom 2026](https://www.freshworks.com/freshdesk/compare-helpdesks/intercom-vs-freshdesk/) ·
[Intercom vs Zendesk vs Freshdesk 2026](https://abhyashsuchi.in/intercom-vs-zendesk-vs-freshdesk-2026/) ·
[Zendesk vs Freshdesk vs Intercom Comparison](https://www.saasgenie.ai/blogs/freshdesk-vs-zendesk-vs-intercom) ·
[Help Desk SLA Guide 2026](https://hiverhq.com/blog/helpdesk-slas) ·
[Helpdesk Ticket Priority Levels](https://www.jitbit.com/news/helpdesk-ticket-priority-levels/) ·
[Data Table UI Design Guide 2026](https://www.setproduct.com/blog/data-table-ui-design) ·
[SaaS Dark Mode UI Design 2026](https://www.orbix.studio/blogs/saas-dark-mode-ui-design) ·
[Dark Mode Accessibility Guide](https://www.accessibilitychecker.org/blog/dark-mode-accessibility/)

### Dark-mode findings (binding, since both themes are required)

- The most common accessibility failure in dark mode is **secondary text** —
  captions, labels, metadata — losing contrast against a dark background.
- The most common visual mistake is a **pure black** (`#000000`) background,
  which against white text produces harsh, fatiguing contrast.
- WCAG 2.2 AA minimums are **4.5:1** for normal text, **3:1** for large text —
  applies identically to both themes, checked as a pair, not assumed from one.

## Product identity

| Field | Value |
|---|---|
| Name | **Wisal** (وِصال) — "connection, an unbroken bond between two parties" |
| Why this name | The literal meaning is the product's purpose: one authoritative, continuous record of a relationship. Pronounces cleanly in English (`Wisal`, /wɪˈsɑːl/) without distortion, so it does not fight the bilingual requirement. Short enough to be a viable custom domain (relevant to ADR-004 / ASM-011). Not a word already claimed by a major CRM competitor |
| Logo mark | Two linked rings — reads as a universal "connection" glyph in English contexts, and echoes the looping tail of the Arabic و (waw), the first letter of "Wisal." Draft in `logo-mark.svg`; intended to be refined visually in Stitch, not treated as final |
| One-liner | A focused Customer Support / Helpdesk CRM: every customer issue tracked as a ticket from intake to resolution, against a clear SLA, with a complete history of who did what |
| Audience | Support Agent · Team Lead / Supervisor · Administrator · **Customer** (via the Customer Portal — a distinct, lightly-authenticated or unauthenticated audience, not an internal role) |
| Modules (MVP-scope decision pending) | Tickets · Customers · Knowledge Base · Channels/Inbox · SLA Rules · Reports · Users/Admin · Customer Portal — see `client-requirements-raw.md` for the full 12-category client list this is drawn from |

## Design tokens — finalized

Primary color is **indigo**, chosen to sit apart from the category's existing
identities (Salesforce blue, HubSpot orange, Pipedrive green/black, Attio
black-and-white) while still reading as trustworthy and enterprise-appropriate.
Contrast for the primary role was verified by computing WCAG relative luminance
directly, not estimated:

| Role | Light value | On background | Computed contrast | Dark value | On background | Computed contrast |
|---|---|---|---|---|---|---|
| Primary | `#4F46E5` | `#FFFFFF` | **6.29:1** | `#818CF8` | `#121317` | **6.23:1** |

Both clear the WCAG 2.2 AA minimum (4.5:1) with headroom. The dark background
`#121317` is a deliberately elevated dark gray, not pure black — per the dark-mode
finding above.

```yaml
color_roles:
  primary:
    light: "#4F46E5"   # verified 6.29:1 on #FFFFFF
    dark:  "#818CF8"   # verified 6.23:1 on #121317
    role:  "Primary CTA — save, create deal, confirm"
  success:
    light: "#059669"
    dark:  "#34D399"
    role:  "Won deal / confirmation — always paired with an icon or label, never color alone"
  warning:
    light: "#D97706"
    dark:  "#FBBF24"
    role:  "Overdue activity / caution"
  danger:
    light: "#DC2626"
    dark:  "#F87171"
    role:  "SLA breached / destructive action — distinct from priority, see below"
  priority:
    note: "A SEPARATE token set from the semantic colors above — priority answers 'how urgent', status answers 'where in the workflow'. Conflating them was flagged explicitly in the competitive analysis as a common mistake."
    low:      { light: "#64748B", dark: "#94A3B8" }   # neutral slate — not alarming
    normal:   { light: "#2563EB", dark: "#60A5FA" }   # blue — informational, not urgent
    high:     { light: "#D97706", dark: "#FBBF24" }   # reuses warning — same value, same meaning
    urgent:   { light: "#DC2626", dark: "#F87171" }   # reuses danger — same value, same meaning
  status:
    note: "Added 2026-08-22 after review found Pending status silently reusing the exact High-priority color — two different columns rendering identically defeats the point of separating them. This gives status its own distinct hues."
    open:     { light: "#4F46E5", dark: "#818CF8" }   # reuses primary — the default/active state
    pending:  { light: "#0E7490", dark: "#22D3EE" }   # teal — deliberately not amber (that's High priority) or blue (that's Normal priority)
    resolved: { light: "#059669", dark: "#34D399" }   # reuses success
  badge_text_on_tint:
    note: "Added 2026-08-22. The general warning/danger LIGHT values above were verified only as button/icon colors on solid #FFFFFF (see the Primary verification above) — never as small badge TEXT on a light tinted background, which is a measurably different contrast situation. Computed by hand from the WCAG relative-luminance formula against the actual tint backgrounds used: warning #D97706 on #FFFBEB measured 3.07:1 (fails AA badly); danger #DC2626 on #FEF2F2 measured 4.42:1 (fails AA narrowly). Dark-theme badge text (#FBBF24, #F87171 on their 14%-opacity fills over #1C1D24) was checked the same way and already clears AA comfortably — only light-theme badge text needs a darker, badge-specific shade. Use these in place of the general warning/danger tokens ONLY for small badge/tag text on a light tint background; buttons and icons on solid backgrounds keep the general tokens above."
    warning: { light: "#B45309", verified: "4.84:1 on #FFFBEB" }
    danger:  { light: "#B91C1C", verified: "5.91:1 on #FEF2F2" }
  neutral_scale:
    light: "#F8FAFC → #0F172A, 9 steps"
    dark_background: "#121317"   # elevated dark gray, never #000000
    note: "A single gray ramp does not serve both themes — each theme gets its own calibrated scale, verified in pairs, not assumed from the other."

typography:
  latin:  "Inter or IBM Plex Sans"
  arabic: "IBM Plex Sans Arabic or Cairo — verify optical size matches the Latin pairing at the same pixel size"
  scale:  "12 / 14 / 16 / 20 / 24 / 32 px"
  line_height: "Arabic script needs ~10-15% more line-height than Latin at the same size"

spacing: "4px base unit — 4 / 8 / 12 / 16 / 24 / 32 / 48"
radius:  "sm 6px · md 10px · lg 16px"
elevation: "Dark theme: layer separation via background-color shift, not shadow — shadow is invisible on a dark surface"
```

**Verification note.** The two contrast ratios above were computed by hand from
the WCAG relative-luminance formula, not read off a palette that merely claims to
be accessible. Every remaining pair in the table (success/warning/danger against
both backgrounds) must be run through an automated contrast checker before
implementation — the same check belongs in CI per the performance/accessibility
budgets, so a future color change cannot silently regress contrast.

## Layout patterns

### Ticket Queue (primary working view)
A structured, sortable/filterable list — not a loose inbox, not a Kanban board by
default (Kanban was the right pattern for a sales pipeline's small number of
deals; a support queue can hold thousands of tickets, where a scannable list with
strong filtering serves faster resolution better). Each row surfaces, at a glance:
**priority** (its own token, see above), **status**, **SLA risk** (time
remaining/overdue, not just a static badge — this is the one thing the SLA
research is explicit about: priority, status, and SLA risk must be visible
*together*, not as separate views an agent has to cross-reference), assigned
agent, channel origin (email/WhatsApp/chat/SMS/web form icon), and last-updated
time. Server-side pagination, faceted filters (priority × status × channel ×
agent), filter state in the URL, bulk-action bar on row selection (bulk assign,
bulk close). **RTL rule:** column order fully mirrors; the SLA-risk and priority
indicators keep their color meaning (color is not a directional property) but
their position in the row mirrors like any other column.

### Conversation Thread (ticket detail)
The single view an agent spends most of their time in, so it is the highest-value
screen to get right. One continuous, chronological thread of every message —
regardless of originating channel — so an agent never has to guess whether a
reply covers what came in over WhatsApp versus email. A persistent side panel
holds ticket metadata (priority, status, SLA countdown, assigned agent, customer
info) so it never scrolls out of view while reading a long thread. AI-assist
(suggested reply, ticket summary) surfaces inline near the reply composer, per
the Intercom pattern noted above — a separate panel the agent has to switch to
defeats the point of an assist feature. **RTL rule:** the metadata panel moves to
the visual left in RTL (mirrors with the rest of the layout); timestamps and
message bubbles still read chronologically top-to-bottom regardless of direction.

### Data table (Customers, Knowledge Base articles)
Server-side pagination, faceted filters, filter state kept in the URL, bulk-action
bar appears on row selection, columns support visibility toggle and reorder.
**RTL rule:** column order fully mirrors; the actions column moves to the visual
left.

### Role-based home (Agent Dashboard)
Content differs by role, not just visibility of a few widgets:
- **Agent** — their assigned queue, tickets approaching SLA breach, quick-reply shortcuts
- **Team Lead / Supervisor** — team queue, workload balance across agents, escalations
- **Administrator** — user management, SLA rule configuration, audit log entry point

Guarded explicitly against the HubSpot clutter pattern (still valid, product-
agnostic finding): a widget is added only when a specific user need names it,
never because the framework made adding one cheap.

## Required states per view

Every data view implements all four, per `acceptance-criteria.md` (AC-UX-01 to
AC-UX-04): **Loading** (skeleton, never a blank screen) · **Empty** (explains why,
offers the next action) · **Error** (actionable, retryable, no raw stack trace) ·
**Success**. Destructive actions add a **Confirmation** state naming the specific
record.

## Accessibility

- Contrast checked as a pair (foreground + the specific background it sits on),
  not assumed from a palette in isolation.
- Focus states always visible — `outline: none` without a replacement is
  forbidden.
- `prefers-reduced-motion` is respected.
- Color is never the only signal for state (e.g., won/lost) — paired with an
  icon or label for color-blind users.

## Internationalization

- Arabic and English, RTL and LTR, both first-class.
- RTL mirrors layout direction, table column order, and directional icons (back
  arrows, chevrons) — not only text alignment.
- **Theme default:** follows the operating system's `prefers-color-scheme` on
  first load; the user's explicit choice thereafter is remembered and overrides
  it.

## Explicit anti-patterns

Each tied to a specific finding above, not a general aesthetic preference:

- Do not let the interface accumulate widgets over time the way HubSpot's review
  warns against — every addition needs a named user need.
- Do not use a pure black dark background.
- Do not encode state in color alone.
- Do not build a dashboard that requires a tooltip to be understood.
- Do not conflate **priority** and **status** into a single badge — they are
  separate tokens for a reason (see the priority palette above).
- Do not fragment a ticket's history by channel — the Conversation Thread must
  show every message from every channel in one chronological view.

## Status

**Reoriented for Support CRM, App Shell built and corrected (2026-08-22).**
Name, logo concept, and full token palette (priority, status, and the
badge-text-on-tint accessibility fix) are decided above. The App Shell was
rebuilt in Claude Design against the correct navigation (Dashboard, Tickets,
Customers, Knowledge Base, Channels, Reports, Admin: SLA Rules/Users) as four
artboards — `references/app-shell/WisalAppShell-{LightLTR,DarkLTR,LightRTL,
DarkRTL}.dc.html` — reviewed for structural parity, RTL mirroring, and color
contrast, with two corrections applied directly to the files: the Pending
status color (was silently identical to High priority) and the two light-theme
badge-text colors that measured below WCAG AA on their tint backgrounds. These
corrected tokens are binding for every subsequent screen — see
`badge_text_on_tint` and `status` above.
