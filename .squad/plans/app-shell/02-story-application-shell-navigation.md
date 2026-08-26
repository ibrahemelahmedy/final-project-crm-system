# Story 02 — Application Shell & Navigation

## Prerequisites

- **Story 01 completed** — [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md). This story consumes what it built and **must not** re-derive any of it:
  - `web/src/features/auth/AuthContext.tsx` — `useAuth()` returns `{ user, status, login, logout }`. The `User` type (**lines 5–13**) already carries `role`, `role_label`, and `home_route`.
  - `web/src/features/auth/RequireAuth.tsx` — the route guard, with its `roles?: User['role'][]` prop and 403 view.
  - `web/src/lib/api.ts` / `web/src/lib/queryClient.ts` — the shared Axios instance and the `QueryClient` singleton.
  - `api/routes/api.php` **lines 14–18** — `GET /api/user` and `POST /api/logout` exist behind `auth:sanctum`. **No backend changes are required by this story.**
- **Verified toolchain state** (checked at plan time, `web/package.json`):

  | Package | Installed version | Matters because |
  |---|---|---|
  | `react-router-dom` | **7.18.2** | Layout routes via `<Outlet />` are available — this story depends on them. |
  | `react` | 19.2.8 | — |
  | `vitest` | 4.1.11 | Test runner. **There is no `test` script in `web/package.json`** — run `npx vitest run`. |
  | `oxlint` | 1.79.0 | `npm run lint`. |

- **`web/src/test/setup.ts` already mocks `window.matchMedia`.** Every component that reads `prefers-color-scheme` depends on that mock in jsdom. Do **not** remove it; the shell's theme provider needs it too.

- **The frontend-architecture PDF is not machine-readable.** `docs/requirements/المعمارية/فرونت/بنية-مشاريع-الواجهة-الأمامية.pdf` uses CID-encoded fonts; text extraction yields nothing. The intake's own paraphrase of it ("`app/layouts/` convention") is the only accessible form and is what Task 1 follows. Do not cite the PDF's contents.

---

## Story Goal

Build the persistent chrome every authenticated screen renders inside, replacing the `DashboardStub` placeholder that Story 01 shipped at `web/src/App.tsx` **lines 10–37**.

User-visible outcomes:

1. Every authenticated route renders inside one sidebar + header shell. `/login` stays outside it.
2. The sidebar lists the **eight** nav items the reviewed design specifies, and every one navigates to a route that resolves.
3. An **Agent** and a **Team Lead** do not see the `ADMIN` group (SLA Rules, Users). An **Administrator** does.
4. The header shows the signed-in user's name and `role_label`, and a working sign-out control.
5. The nav item matching the current route is marked active **visually and with `aria-current="page"`**.
6. The theme toggle persists an explicit choice and overrides `prefers-color-scheme`; with no choice ever made, the OS setting wins.
7. Below the tablet breakpoint the sidebar collapses to a drawer, and the page never scrolls horizontally.
8. Under `dir="rtl"` the sidebar moves to the visual right and the layout mirrors, without a second stylesheet.

**In scope beyond the obvious:** extracting the theme/direction state that currently lives **duplicated inside `LoginPage.tsx`** (lines 46–88) into one shared provider, and creating the six placeholder routes the sidebar needs so outcome 2 can be true.

**Explicitly NOT in scope** (from the intake's own "Out of scope" block):

- The body content of any page. Each feature story owns its own screen. This story ships placeholders.
- The Channels page itself (WIS-15) — this story supplies only the nav item.
- The notification bell's behaviour and data (WIS-13), and the language switcher's behaviour (WIS-11). **This story defines their header slots and nothing more.**
- Custom branding / white-labelling — the shell renders the Wisal identity only.
- **Arabic string catalogues.** The RTL *layout* is this story; the Arabic *strings* are WIS-11. See the Product-rules table.

---

## Context — Read These Files First

1. `docs/design/references/1.app-shell/WisalAppShell-LightLTR.dc.html` — **the primary reference; build from it, do not invent.** 183 lines, one artboard. Read:
   - **Lines 22–51** — the whole sidebar: 260px fixed, `background:#FFFFFF`, `border-right:1px solid #E2E8F0`, `padding:20px 14px`.
   - **Lines 30–35** — the six main nav items. **Line 30 is the active state**: `background:#EEF2FF; color:#4F46E5; font-weight:600`. Lines 31–35 are inactive: `color:#475569; font-weight:500`. All at `padding:9px 12px; border-radius:8px; font-size:14px; gap:10px`.
   - **Line 38** — the `ADMIN` group label: `font-size:11px; font-weight:700; letter-spacing:.08em; color:#94A3B8`.
   - **Lines 40–41** — SLA Rules and Users.
   - **Lines 44–50** — the sidebar-bottom user block (avatar initials, name, subtitle) on `background:#F8FAFC; border-radius:10px`.
   - **Lines 55–80** — the header: `height:68px`, `padding:0 24px`, `gap:14px`, `border-bottom:1px solid #E2E8F0`.
   - **Lines 72–79** — the header user block: 32px avatar, name at 12.5px/600, role badge at 10px/700 on `#EEF2FF`, chevron.
2. `docs/design/references/1.app-shell/WisalAppShell-DarkLTR.dc.html` — the dark palette. Read **line 20** (page `#121317`), **line 22** (sidebar `#1C1D24`, border `#2A2C33`), **line 28** (active nav: `background:rgba(129,140,248,0.14); color:#A5B4FC`), **line 50** (header `#1C1D24`).
3. `docs/design/references/1.app-shell/WisalAppShell-LightRTL.dc.html` — **read this to understand what mirroring means here, then implement it with logical properties instead.** Note **line 20** (`dir="rtl"` on the artboard root, and the font family switches to `'IBM Plex Sans Arabic'`), **line 22** (the export hand-mirrors `border-right` → `border-left`), and **line 54** (the `⌘K` badge carries an explicit `direction:ltr` — a keyboard shortcut must **not** mirror).
4. **Grep before you copy.** The recurring class-omission defect documented in `STATUS.md` **lines 49–53** does **not** apply here — verified: all four exports contain **zero** occurrences of `fv`, `fvd`, and `sk`. But that is because **they contain no classes at all** — every style is inline, and there is no `outline`, `focus`, `tabindex`, or `aria-` attribute anywhere in any of the four files. **Every nav item is a `<div>`.** The exports are therefore a *visual* reference only; the entire accessible structure in Task 4 is new work, not a copy.
5. `web/src/App.tsx` — **lines 10–37** the `DashboardStub` this story deletes; **lines 39–85** the route tree it restructures. Note **line 78**, the `*` catch-all that currently redirects to `/dashboard`.
6. `web/src/features/auth/LoginPage.tsx` — **lines 46–60** (`getInitialTheme` / `getInitialLang`, reading `wisal-theme` / `wisal-lang`), **lines 71–88** (`resolvedTheme`, `toggleTheme`, `toggleLang`), and **lines 158–219** (the light/dark custom-property blocks and the `:not([data-theme="light"])` guard pattern). Task 2 lifts this logic out; **the token values are the precedent to match.**
7. `web/src/features/auth/AuthContext.tsx` — **lines 5–13** the `User` type, **lines 35–45** `logout()` (server-first, `queryClient.clear()`, 401-as-success). The header's sign-out calls this; do not write a second logout path.
8. `docs/design/brief.md` — **lines 189–197** (`## Accessibility`: `outline: none` without a replacement is **forbidden**; `prefers-reduced-motion` respected; colour never the only signal), **lines 199–206** (`## Internationalization`: RTL mirrors layout, column order, and directional icons — *not only text alignment*; theme follows the OS on first load and an explicit choice overrides it), **lines 181–187** (`## Required states per view`), and **lines 128–129** (`spacing: 4px base` · `radius: sm 6px · md 10px · lg 16px`).
9. [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md) — the precedent for structure and tone. Read its **Task 8** for the `features/` + `lib/` layout rule this story extends, and its **Done Criteria** line forbidding `src/pages/`.

---

## Product rules — where this plan resolves a conflict

Each row is a deliberate decision. Do not silently revert one.

| Source says | This plan does | Why |
|---|---|---|
| Intake: place the layout under **`app/layouts/`** | `web/src/app/layouts/AppLayout.tsx` | Story 01's Done Criteria forbids `src/auth/` and `src/pages/` — it does **not** forbid `src/app/`. The shell is chrome, not a feature, so it does not belong under `features/`. Both constraints are satisfied. |
| Intake AC: "header … shows the signed-in user + role" | Build **both** the header block (export lines 72–79) **and** the sidebar-bottom block (lines 44–50) | The reviewed design has the user in both places. The design is the later, reviewed artifact; the intake sentence is a summary, not an exclusion. |
| Intake AC: Administrator-only items hidden from an **Agent** | The `ADMIN` group renders **only** for `role === 'administrator'` | Hiding it from an Agent but showing it to a Team Lead would be an odd middle state the design does not depict. "Administrator-only" is taken literally. A Team Lead sees the six main items. |
| Intake AC: "a viewport below the **tablet breakpoint**" | **1024px.** Below it, the sidebar becomes a drawer. | Verified: `docs/design/brief.md` defines **no** breakpoints — grep for `breakpoint`/`tablet`/`768`/`1024` returns nothing. The number is therefore decided here rather than inherited, and 1024px is where a 260px fixed sidebar stops leaving a usable content column. Record it as a token in Task 2 so later stories share it. |
| Intake AC: skeleton "before its user data has loaded" | Build `HeaderUserSkeleton`, render it when `user` is `null`, and reserve the slot's dimensions unconditionally | **The loading window is currently zero-length.** Story 01's `AuthContext` has no `'loading'` status and deliberately makes no bootstrap `GET /api/user` call, so `user` is set synchronously at login and `RequireAuth` blocks the anonymous case. The skeleton is built for the reserved-space guarantee now, and becomes live the day a refresh-token flow lands. **Do not add a `GET /api/user` fetch to satisfy this criterion** — Story 01 forbids that request explicitly. |
| Design: header carries a search box and a **New Ticket** button (export lines 56–63) | Render both, structurally faithful, **inert** — the search is a non-focusable presentational affordance, the button is `disabled` with `title="Coming soon"` | Deleting them makes the shell stop matching the reviewed design; wiring them invents scope no story owns yet. An inert control that is visibly inert is honest. **Do not attach handlers.** |
| Design RTL export hand-mirrors `border-right` → `border-left` | Use `border-inline-end` and friends throughout | The intake's technical hint, and the only way one stylesheet serves both directions. The RTL export is the expected *result*, not the technique. |

---

## Implementation tasks

**No backend changes required.** `GET /api/user` and `POST /api/logout` already exist (`api/routes/api.php` lines 14–18) and this story adds no endpoint.

### 1 — Create the shell directory and the nav manifest

Target layout — `app/` sits beside `features/` and `lib/`, holding what is neither a feature nor a shared utility:

```
web/src/
  app/
    layouts/
      AppLayout.tsx          the shell: sidebar + header + <Outlet />
      AppLayout.test.tsx
    providers/
      UiPreferencesContext.tsx   theme + direction, extracted from LoginPage
      UiPreferencesContext.test.tsx
    navigation/
      navItems.tsx           the eight items, one array, with icons
    components/
      NavItem.tsx            one sidebar link
      HeaderUserSkeleton.tsx
  features/                  unchanged
  lib/                       unchanged
```

**Create file: `web/src/app/navigation/navItems.tsx`** — the single source of truth for the sidebar. Every nav item, its route, its icon, and which roles may see it. **No component hard-codes a nav label or a path.**

```tsx
import type { User } from '../../features/auth/AuthContext';

export type NavItemDef = {
  /** i18n key for WIS-11; the English label is the fallback until then. */
  labelKey: string;
  label: string;
  to: string;
  icon: React.ReactNode;
  /** Undefined = visible to every role. */
  roles?: User['role'][];
  group: 'main' | 'admin';
};
```

The eight items, in this order. **Paths and labels are binding** — they must match Task 5's routes exactly, or a nav item points at a 404 and the intake's second acceptance criterion fails. Icon paths are copied verbatim from `WisalAppShell-LightLTR.dc.html` lines 30–35 and 40–41; every icon is rendered at `width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"` with `aria-hidden="true"`.

| # | Label | `to` | Group | `roles` | Icon `d` (from export line) |
|---|---|---|---|---|---|
| 1 | Dashboard | `/dashboard` | main | — | `M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z` (30) |
| 2 | Tickets | `/tickets` | main | — | `M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z M9 6v12` (31) |
| 3 | Customers | `/customers` | main | — | `M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3 2.5-5 5-5s5 2 5 5 M17 11a3 3 0 1 0 0-6 M14 20c.3-2.5 2-4.3 4-4.7 M21 20c-.2-1.7-1-3-2.3-3.8` (32) |
| 4 | Knowledge Base | `/knowledge-base` | main | — | `M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5c-.8 0-1.5-.7-1.5-1.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5c.8 0 1.5-.7 1.5-1.5z` (33) |
| 5 | Channels | `/channels` | main | — | `M4 5h16v10H8l-4 4z` (34) |
| 6 | Reports | `/reports` | main | — | `M5 20V10 M11 20V4 M17 20v-7` (35) |
| 7 | SLA Rules | `/sla-rules` | admin | `['administrator']` | `M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9.5 12l1.8 1.8L14.5 10` (40) |
| 8 | Users | `/users` | admin | `['administrator']` | `M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 20c.3-3 2.7-5 5.5-5s5.2 2 5.5 5 M18 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M18 10.5v1M18 15.3v1M15.4 12.4l.9.5M19.7 15l.9.5M15.4 15.6l.9-.5M19.7 12l.9-.5` (41) |

Export a filter helper beside the array so the sidebar and its test agree on one rule:

```tsx
export function visibleNavItems(role: User['role']): NavItemDef[] {
  return navItems.filter((item) => !item.roles || item.roles.includes(role));
}
```

**State in a comment in this file:** *filtering here is a UX affordance, not a security boundary — server-side authorization is the real gate, and hiding a nav item is not access control.* This mirrors the comment already at `web/src/features/auth/RequireAuth.tsx` **lines 10–11**; keep the wording consistent.

### 2 — Extract theme and direction into one provider

`web/src/features/auth/LoginPage.tsx` **lines 46–88** currently owns this logic privately. Two screens with two copies is how the login page and the shell drift into disagreeing about the theme.

**Create file: `web/src/app/providers/UiPreferencesContext.tsx`**

```ts
export type Theme = 'system' | 'light' | 'dark';
export type Direction = 'ltr' | 'rtl';

type UiPreferences = {
  theme: Theme;                       // the stored preference
  resolvedTheme: 'light' | 'dark';    // what actually renders
  direction: Direction;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setDirection: (d: Direction) => void;
};
```

Move `getInitialTheme` (LoginPage lines 46–52) into this file **unchanged in behaviour**, including its `try/catch` around `localStorage`. Keep the storage keys **`wisal-theme`** and **`wisal-lang`** exactly as they are — changing them silently discards every existing user's saved preference.

Three rules the implementation must hold, each of which a naive version breaks:

- **Never write to `localStorage` on mount.** Persist only inside `setTheme` / `toggleTheme`, i.e. only on an explicit user action. Writing the resolved theme in a `useEffect` would (a) violate `brief.md` line 204 by freezing the OS-follows default into an explicit choice the user never made, and (b) break the assertion at `web/src/features/auth/AuthContext.test.tsx` **line 61** that `localStorage.length` is `0`.
- **Subscribe to the media query, do not sample it once.** Read `window.matchMedia('(prefers-color-scheme: dark)')` and attach a `change` listener, so a user flipping their OS theme while `theme === 'system'` sees the app follow. `LoginPage.tsx` **line 73** samples it during render and never updates — that is the bug being fixed here, not a pattern to copy.
- **Apply to `<html>`, not to a wrapper div.** Set `document.documentElement.dataset.theme = resolvedTheme` and `document.documentElement.dir = direction`. The drawer overlay in Task 6 renders above everything, and a wrapper-scoped `data-theme` cannot reach it.

**File: `web/src/index.css`** — move the light/dark custom-property blocks out of `LoginPage.tsx`'s inline `<style>` (**lines 158–219**) to `:root` here, so both the login screen and the shell read one palette. Keep the three-block structure LoginPage established — bare `:root`, then `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`, then `:root[data-theme="dark"]` — because it is what makes an explicit choice win in both directions. Add the shell's own tokens from the exports:

```css
:root {
  --sidebar-bg: #FFFFFF;          /* export LightLTR line 22 */
  --sidebar-border: #E2E8F0;
  --sidebar-width: 260px;
  --header-bg: #FFFFFF;           /* export LightLTR line 55 */
  --header-border: #E2E8F0;
  --header-height: 68px;
  --nav-active-bg: #EEF2FF;       /* export LightLTR line 30 */
  --nav-active-fg: #4F46E5;
  --nav-idle-fg: #475569;
  --nav-group-label: #94A3B8;     /* export LightLTR line 38 */
  --shell-breakpoint: 1024px;     /* decided in this plan — see Product rules */
}
```

and the dark values in both dark blocks: `--sidebar-bg: #1C1D24`, `--sidebar-border: #2A2C33`, `--header-bg: #1C1D24`, `--header-border: #2A2C33`, `--nav-active-bg: rgba(129,140,248,0.14)`, `--nav-active-fg: #A5B4FC`, `--nav-idle-fg: #94A3B8` (export `WisalAppShell-DarkLTR.dc.html` lines 22, 28, 50).

**File: `web/src/features/auth/LoginPage.tsx`** — delete `getInitialTheme`, `getInitialLang`, the `theme`/`lang` state, `resolvedTheme`, `toggleTheme`, and `toggleLang` (**lines 46–60 and 64–88**), and consume `useUiPreferences()` instead. **Keep the `translations` object and the language toggle button exactly as they are** — they are outside this story's scope and the user has asked for them to stay. The login page keeps its own `data-theme` on `.login-root` for its self-contained styling; it simply reads the value from the provider now.

**File: `web/src/main.tsx`** — nothing to change here; the provider is mounted in `App.tsx` (Task 5).

### 3 — The sidebar nav item

**Create file: `web/src/app/components/NavItem.tsx`** — one `NavLink` per entry. This is where the export's biggest gap is closed: the exports render nav items as `<div>`s with no role, no focus state, and no active semantics.

```tsx
import { NavLink } from 'react-router-dom';

export const NavItem: React.FC<{ item: NavItemDef; onNavigate?: () => void }> = ({ item, onNavigate }) => (
  <NavLink
    to={item.to}
    end={item.to === '/dashboard'}
    onClick={onNavigate}
    className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
    aria-current={undefined /* set below — see note */}
  >
    {item.icon}
    <span>{item.label}</span>
  </NavLink>
);
```

Three details that are each a distinct acceptance criterion:

- **`aria-current="page"` is mandatory and is not automatic.** React Router v7's `NavLink` applies an `active` class but **does not** set `aria-current` for you in every configuration — set it explicitly from the render-prop's `isActive`, using the `children` render-prop form so the same flag drives both. Visual-only active state fails the intake's fifth criterion by name.
- **`end` on `/dashboard` only.** Without it, `/dashboard` matches while the user is on `/dashboard/admin` and two items light up at once. Every other path is a distinct prefix, so `end` is unnecessary and would break future nested routes.
- **`onNavigate`** is how the mobile drawer closes itself on selection (Task 6). A drawer that stays open over the page it just navigated to is the most common failure of this pattern.

Styles in `web/src/index.css`, from export lines 30–35, **using logical properties**:

```css
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding-block: 9px; padding-inline: 12px;
  border-radius: 8px;
  font-size: 14px; font-weight: 500;
  color: var(--nav-idle-fg);
  text-decoration: none;
  min-height: 40px;              /* touch target; the export's 9px padding alone is 36px */
}
.nav-item--active {
  background: var(--nav-active-bg);
  color: var(--nav-active-fg);
  font-weight: 600;
}
.nav-item:focus-visible {
  outline: 2px solid var(--nav-active-fg);
  outline-offset: 2px;
}
```

**Do not write `outline: none` anywhere in this story** without a replacement in the same rule — `docs/design/brief.md` line 193 forbids it, and unlike the login exports there is no `.fv` rule here to fall back on.

### 4 — `AppLayout`

**Create file: `web/src/app/layouts/AppLayout.tsx`** — the shell itself. It renders the sidebar, the header, and `<Outlet />`; it renders **no page content of its own**.

Structure, from `WisalAppShell-LightLTR.dc.html` lines 22–80:

```tsx
export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // …
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav className="shell-sidebar" aria-label="Main">{/* … */}</nav>
      <div className="shell-column">
        <header className="shell-header">{/* … */}</header>
        <main id="main-content" className="shell-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
```

**Sidebar** (`<nav aria-label="Main">`, `inline-size: var(--sidebar-width)`, `border-inline-end: 1px solid var(--sidebar-border)`, `padding-block: 20px`, `padding-inline: 14px`, `display:flex; flex-direction:column`):

- **Brand** — the two-circle logo from export line 26 (`viewBox="0 0 64 64"`, 26×26, circles at `cx=24 cy=32 r=14` and `cx=42 cy=32 r=9`, `stroke-width=7`) with `stroke="currentColor"` so it inherits `--nav-active-fg` in both themes, beside the wordmark **"Wisal"** at 18px/700. The export hard-codes `#4F46E5` light / `#818CF8` dark; `currentColor` gets both from one element.
- **Main group** — `visibleNavItems(user.role).filter(i => i.group === 'main')` mapped through `NavItem`, `gap: 2px`.
- **Admin group** — rendered **only when** `visibleNavItems(...)` yields at least one `group === 'admin'` item. Never render an empty group with a dangling `ADMIN` heading. The heading is a `<h2>` styled to the export's line 38 (11px/700, `letter-spacing:.08em`, `color: var(--nav-group-label)`), visually small but a real heading so the nav has structure for a screen-reader.
- **User block** — export lines 44–50: initials avatar, `user.name` at 13px/600, `user.role_label` at 11px muted, on `background: var(--bg-page)`, `border-radius: 10px`, pushed down with `margin-block-start: auto`.

**Header** (`<header>`, `block-size: var(--header-height)`, `border-block-end: 1px solid var(--header-border)`, `padding-inline: 24px`, `gap: 14px`):

In inline order — and the order **mirrors automatically** under RTL because the row is a flex container with no hard-coded sides:

1. **Drawer toggle** — a `<button>` visible only below `--shell-breakpoint`, `aria-label="Open navigation"`, `aria-expanded={drawerOpen}`, `aria-controls` pointing at the sidebar's `id`. Task 6 wires it.
2. **Search affordance** — export lines 56–60. **Inert**: render as a `<div aria-hidden="true">`, not an `<input>`, so it is not focusable and not announced. Keep the `⌘K` badge and give it `direction: ltr` (export RTL line 54) so the shortcut does not mirror.
3. Spacer `<div style={{ flex: 1 }} />`.
4. **New Ticket** button — export lines 62–63. `disabled`, with `title="Coming soon"`.
5. Divider (1px × 24px, `background: var(--header-border)`).
6. **Theme toggle** — 36×36, moon icon `M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z` (export line 66). Calls `toggleTheme()` from Task 2. `aria-label` flips between "Switch to dark mode" and "Switch to light mode" — never label it just "Theme".
7. **Language slot** — the globe button from export line 68 (`M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17 M12 3c2.3 2.5 3.5 5.7 3.5 9s-1.2 6.5-3.5 9c-2.3-2.5-3.5-5.7-3.5-9s1.2-6.5 3.5-9z`). **Render the slot; WIS-11 owns the behaviour.** Ship it `disabled` with `title="Coming soon"` rather than half-wired.
8. **Notification slot** — the bell from export lines 69–71, including the red dot. **Render the slot; WIS-13 owns the behaviour.** Same treatment: `disabled`, `title="Coming soon"`. Mark the dot `aria-hidden="true"` so it does not announce a count that no code produces yet.
9. **User block + sign-out** — export lines 72–79: 32px initials avatar, `user.name` 12.5px/600, `user.role_label` in the tinted badge (10px/700, `background: var(--nav-active-bg)`, `color: var(--nav-active-fg)`), chevron `M5 8l7 7 7-7`. The **sign-out** control is a real `<button>` that calls `logout()` from `AuthContext` — do **not** write a second logout path; `AuthContext.tsx` lines 35–45 already handles server-first ordering, 401-as-success, and `queryClient.clear()`.

Add a **skip link** as the first focusable element (`.skip-link`, visually hidden until `:focus-visible`, then pinned to the top-inline-start corner). Eight nav items ahead of the main content is exactly the situation a skip link exists for, and the intake's keyboard criterion is not credibly met without one.

**Create file: `web/src/app/components/HeaderUserSkeleton.tsx`** — a 32px circle and two grey bars at the header block's exact dimensions. Render it when `user` is `null`. Wrap its shimmer in `@media (prefers-reduced-motion: reduce) { animation: none; }` per `brief.md` line 195. **The reserved dimensions matter more than the shimmer** — they are what prevents the layout shift the intake names.

### 5 — Rewire the routes

**File: `web/src/App.tsx`** — replace the whole file body below the imports.

- **Delete `DashboardStub` (lines 10–37) entirely.** Its inline sign-out button is superseded by the header's.
- **Mount `UiPreferencesProvider`** inside `QueryClientProvider` and outside `BrowserRouter`, so a preference change does not remount the router.
- Keep the three provider rules Story 01 established and asserted: `QueryClientProvider` outermost with the singleton from `lib/queryClient`, `AuthProvider` **inside** `BrowserRouter`, and `ReactQueryDevtools` guarded by `import.meta.env.DEV`.

The route tree becomes one **layout route** wrapping every protected path:

```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
    <Route path="/dashboard" element={<PagePlaceholder title="Dashboard" />} />
    <Route path="/dashboard/team" element={<RequireAuth roles={['team_lead', 'administrator']}><PagePlaceholder title="Team Dashboard" /></RequireAuth>} />
    <Route path="/dashboard/admin" element={<RequireAuth roles={['administrator']}><PagePlaceholder title="Admin Dashboard" /></RequireAuth>} />
    <Route path="/tickets" element={<PagePlaceholder title="Tickets" />} />
    <Route path="/customers" element={<PagePlaceholder title="Customers" />} />
    <Route path="/knowledge-base" element={<PagePlaceholder title="Knowledge Base" />} />
    <Route path="/channels" element={<PagePlaceholder title="Channels" />} />
    <Route path="/reports" element={<PagePlaceholder title="Reports" />} />
    <Route path="/sla-rules" element={<RequireAuth roles={['administrator']}><PagePlaceholder title="SLA Rules" /></RequireAuth>} />
    <Route path="/users" element={<RequireAuth roles={['administrator']}><PagePlaceholder title="Users" /></RequireAuth>} />
  </Route>
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>
```

Three things this shape gets right that the obvious alternative does not:

- **`RequireAuth` wraps the layout once**, not each route. The anonymous redirect then happens before any shell chrome renders, so an unauthenticated user never sees a flash of sidebar.
- **The role-restricted routes keep their own inner `RequireAuth`.** The nav-level filter in Task 1 hides the links; this is the route-level guard that still answers a typed URL. Both are UX; the server remains the boundary. **Removing either is a regression** — `/sla-rules` and `/users` are new routes and are guarded from the start.
- **The `*` catch-all stays outside the layout route** (matching `App.tsx` line 78 today), so an unknown path redirects rather than rendering an empty shell.

**Create file: `web/src/app/components/PagePlaceholder.tsx`** — one `<h1>{title}</h1>` and a short line naming the story that will fill it. Every feature story replaces one of these. Give it a `data-testid="page-placeholder"` so `AppLayout.test.tsx` can assert the `<Outlet />` renders.

### 6 — Responsive: the drawer

Below `--shell-breakpoint` (**1024px**), the 260px sidebar leaves no usable content column, so it becomes an overlay drawer.

```css
@media (max-width: 1023px) {
  .shell-sidebar {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;         /* mirrors under RTL with no second rule */
    transform: translateX(-100%);  /* see note below */
    transition: transform 0.2s ease;
    z-index: 40;
  }
  .shell-sidebar[data-open='true'] { transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .shell-sidebar { transition: none; }
}
```

- **`transform: translateX(-100%)` does not mirror on its own.** `inset-inline-start` flips, but the transform is physical — under RTL the drawer would slide *into* the page from the wrong edge. Pair it with `[dir='rtl'] .shell-sidebar { transform: translateX(100%); }`. This is the one place logical properties do not carry the whole load, and it is the easiest thing in this task to miss.
- **Body scroll lock while open**, released on close — including on the unmount path, or a route change with the drawer open leaves the page permanently unscrollable.
- **Close on `Escape`, on backdrop click, and on `onNavigate`** (Task 3). Focus moves to the drawer on open and returns to the toggle on close.
- The backdrop is a `<div>` with `aria-hidden="true"` behind the drawer at a lower `z-index`. **Do not** use a `<dialog>` here — it introduces a top-layer that the theme's `data-theme` on `<html>` reaches, but whose default backdrop styling fights the token palette for no gain.
- Above the breakpoint the drawer state is irrelevant; the sidebar is a static flex child. Make sure `drawerOpen` cannot leave a `transform` applied at desktop width — scope every drawer rule inside the media query, as above.

**Horizontal overflow is a named acceptance criterion.** Give `.shell-main` `min-inline-size: 0` and `overflow-x: auto`. A flex child defaults to `min-width: auto`, which lets a wide table push the whole page sideways — the page body must never scroll horizontally; a wide child scrolls inside its own container.

---

## Edge Cases & Failure Modes

- **`user` is `null` inside `AppLayout`.** Cannot happen through the route tree — `RequireAuth` (`web/src/features/auth/RequireAuth.tsx` lines 16–18) redirects first. `AppLayout` must still render `HeaderUserSkeleton` rather than dereferencing `user.name`, because a direct unit render in a test has no guard above it.
- **Theme persisted on mount.** A `useEffect` that writes `resolvedTheme` to `localStorage` on every render turns the OS-follows default into a permanent explicit choice on first paint, and breaks `web/src/features/auth/AuthContext.test.tsx` **line 61**. Persist **only** in `setTheme`/`toggleTheme`. Asserted by Test Plan item 2.
- **OS theme changes while the app is open.** With `theme === 'system'` the app must follow. Requires a `change` listener on the media query list, not the single sample `LoginPage.tsx` line 73 does today.
- **`localStorage` throws.** Private-mode and hardened browsers throw on both read and write. `getInitialTheme` (LoginPage lines 47–51) already wraps in `try/catch`; the extracted version must keep it on the **write** path too, or a toggle click crashes the shell.
- **Two nav items active at once.** `/dashboard` matches `/dashboard/admin` as a prefix. Fixed by `end` on the Dashboard item only (Task 3). Asserted by Test Plan item 3.
- **`aria-current` present but stale.** Setting it from a local `useLocation()` comparison instead of `NavLink`'s own `isActive` produces a value that disagrees with the highlight after a redirect. Drive both from the same render-prop flag.
- **Drawer left open across a route change.** Without `onNavigate`, selecting an item navigates behind an open overlay. Without releasing the scroll lock on unmount, the page stays unscrollable afterwards.
- **RTL drawer slides from the wrong edge.** `transform: translateX(-100%)` is physical and does not mirror. See Task 6.
- **The `⌘K` badge mirrors under RTL.** The export sets `direction: ltr` on it explicitly (`WisalAppShell-LightRTL.dc.html` line 54). Omitting that renders `K⌘`.
- **Admin group heading with no items.** Rendering the `ADMIN` `<h2>` unconditionally leaves an Agent with a heading over empty space. Render the group only when it has at least one visible item.
- **A nav item pointing at a route that does not exist.** The intake's second criterion. Six of the eight paths are new in Task 5. The manifest and the route tree are two lists that must agree — Test Plan item 4 asserts every `navItems` path resolves to something other than the `*` redirect, so they cannot silently drift.
- **The `*` catch-all masks a typo.** Because unknown paths redirect to `/dashboard`, a mistyped `to` in the manifest looks like a working link that goes to the wrong place rather than an obvious 404. This is precisely why item 4 asserts resolution rather than eyeballing the sidebar.
- **`prefers-reduced-motion` ignored on the drawer.** `brief.md` line 195 is binding; the drawer transition and the skeleton shimmer both need the guard.
- **Horizontal overflow from a flex child.** `.shell-main` needs `min-inline-size: 0`; see Task 6.
- **Uncertainty, recorded rather than guessed:** the frontend-architecture PDF could not be read (CID-encoded fonts, extraction yields zero text). The `app/layouts/` placement in Task 1 follows the **intake's paraphrase** of it. If that PDF later proves to mandate a different structure, moving `app/` is a rename, not a rewrite — nothing outside `App.tsx` imports from it by path.

---

## Test Plan

Vitest + Testing Library, matching the patterns already in `web/src/features/auth/LoginPage.test.tsx` (fresh `QueryClient` per test; `vi.mock('../../lib/api')`). **There is no `test` script** — run `npx vitest run`.

1. **`web/src/app/navigation/navItems.test.ts`** (unit) — no DOM needed:
   - `it exposes exactly eight items` — guards against a silent addition.
   - `it hides the admin group from an agent and a team lead` — `visibleNavItems('agent')` and `visibleNavItems('team_lead')` both return 6 items and contain neither `/sla-rules` nor `/users`.
   - `it shows all eight to an administrator`.
2. **`web/src/app/providers/UiPreferencesContext.test.tsx`** (unit):
   - `it follows prefers-color-scheme when no choice was ever made` — mock `matchMedia` to report `matches: true`; assert `resolvedTheme === 'dark'` **and that `localStorage.length` is still `0`**. The storage assertion is the point of the test — it is what stops the mount-write regression.
   - `it persists an explicit choice and overrides the OS` — `matches: true`, call `setTheme('light')`, assert `resolvedTheme === 'light'` and `localStorage.getItem('wisal-theme') === 'light'`.
   - `it survives a throwing localStorage` — stub `setItem` to throw; assert `toggleTheme()` does not throw and `resolvedTheme` still flips.
   - `it reacts to an OS theme change while on system` — dispatch the media query's `change` event; assert `resolvedTheme` follows.
3. **`web/src/app/layouts/AppLayout.test.tsx`** (unit, rendered inside `MemoryRouter` + `AuthProvider` with a seeded user):
   - `it renders the outlet content` — assert `data-testid="page-placeholder"` is present.
   - `it marks only the active nav item with aria-current` — render at `/dashboard/admin` as an administrator; assert **exactly one** element has `aria-current="page"`, and that it is Dashboard-or-not per the `end` rule. Use `getAllByRole('link')` and count, so a second highlighted item fails loudly.
   - `it shows the signed-in name and role_label in the header`.
   - `it calls logout from AuthContext when sign-out is clicked` — spy on the context's `logout`; assert one call. Do **not** assert on `api.post` here; that path is already covered by `AuthContext.test.tsx`.
   - `it renders the skeleton when user is null` — render `AppLayout` without a user; assert the skeleton and **no crash**.
   - `it hides SLA Rules and Users from an agent` — the render-level counterpart to item 1's unit check.
4. **`web/src/app/navigation/navRoutes.test.tsx`** (integration) — the one test that stops the manifest and the router drifting apart:
   - For **every** entry in `navItems`, render `<App />` (or the route tree) at that path as an **administrator** and assert the rendered placeholder's title matches, i.e. the path did **not** fall through to the `*` redirect to `/dashboard`. Drive it with `it.each(navItems)` so adding a ninth item without a route fails immediately.
5. **`web/src/app/layouts/AppLayout.drawer.test.tsx`** (unit):
   - `it opens and closes the drawer from the toggle` — assert `aria-expanded` flips and the sidebar's `data-open` follows.
   - `it closes the drawer when a nav item is selected`.
   - `it closes the drawer on Escape and returns focus to the toggle`.
   - `it releases the body scroll lock on unmount` — assert `document.body.style.overflow` is restored.
6. **Regression — `web/src/features/auth/LoginPage.test.tsx`** — all **12** currently-passing tests must still pass after Task 2 removes the theme/lang state from `LoginPage.tsx`. The language toggle stays, so `it renders login form with all inputs and submit button` and the button-name queries are unaffected. **If a test needs changing, the refactor is wrong** — the login page's behaviour is not in this story's scope.
7. **Regression — `web/src/features/auth/AuthContext.test.tsx`** — both tests must still pass, in particular the `localStorage.length === 0` assertion at line 61.
8. **Manual only (Verification Step 6):** dark-mode rendering, RTL mirroring, and the 360px drawer. jsdom does not resolve computed CSS or real `dir` layout meaningfully. **Do not fake this with a snapshot test that asserts nothing real.**

---

## Verification Steps

Node commands run in `web/`.

1. **Frontend tests pass:** `npx vitest run` — every test above green, and the 14 pre-existing tests (12 in `LoginPage.test.tsx`, 2 in `AuthContext.test.tsx`) still green. Zero failures.
2. **Types and lint clean:** `npm run build` (runs `tsc -b` then `vite build`) completes with no errors, and `npm run lint` reports none.
3. **Devtools still excluded:** confirm `ReactQueryDevtools` appears nowhere in `web/dist/assets/*.js` after the build — Story 01's Done Criteria, and the provider restructuring in Task 5 is exactly the kind of edit that loses the `import.meta.env.DEV` guard.
4. **Backend untouched:** in `api/`, `php artisan test` — **21 tests** still pass. This story changes no PHP; a failure here means something was edited that should not have been. Run PHP from **PowerShell** (`& "C:\Users\ibrah\.config\herd\bin\php84\php.exe" artisan test`).
5. **App runs:** `php artisan serve` in `api/` and `npm run dev` in `web/`. Sign in as `agent@wisal.test` — land on `/dashboard` **inside the shell**. Confirm the sidebar shows **six** items and **no** `ADMIN` heading. Sign out from the header, sign in as `admin@wisal.test`, land on `/dashboard/admin`, and confirm **eight** items under an `ADMIN` heading. Click each of the eight — every one renders its placeholder, none redirects to `/dashboard`.
6. **Regression on theme, direction, responsiveness, and keyboard:**
   - **Theme:** with the OS in dark mode and no prior choice, the shell renders on `#121317` with the sidebar at `#1C1D24`. Click the toggle → light. Reload → still light. Clear `localStorage` and reload → follows the OS again.
   - **RTL:** set `dir="rtl"` on `<html>`. The sidebar moves to the visual **right**, its border moves to its left edge, and no element overflows. The `⌘K` badge still reads `⌘K`.
   - **Responsive:** narrow to **360px**. The sidebar is gone and the toggle appears; opening it slides the drawer in from the correct edge in **both** directions; selecting an item closes it. **No horizontal scrollbar on the page body at any width from 360px up.**
   - **Keyboard:** from a fresh load, `Tab` once — the skip link appears with a visible ring. Tab through the sidebar and header: every nav item and every enabled control is reachable, in order, each with a visible focus ring. The three inert controls (search, language, notifications) are skipped or announced as disabled — never focusable-but-dead.
   - **Reduced motion:** enable it at the OS level — the drawer snaps rather than sliding, and the skeleton does not shimmer.

---

## Done Criteria

- [ ] Every authenticated route renders inside `AppLayout` via a single layout route; `/login` renders outside it; no page component imports the shell for itself.
- [ ] `DashboardStub` is deleted from `web/src/App.tsx`, and its inline sign-out button is gone — the header owns sign-out.
- [ ] The sidebar renders exactly the **eight** items from `navItems`, in the design's order, and **every** path resolves to its own placeholder rather than falling through the `*` redirect — asserted by an `it.each` test over the manifest, not by inspection.
- [ ] An Agent and a Team Lead see six items and **no** `ADMIN` heading; an Administrator sees eight under the heading. The empty-group case cannot render a dangling heading.
- [ ] `/sla-rules` and `/users` are additionally guarded by `RequireAuth roles={['administrator']}` at the route level, and a comment in `navItems.tsx` states that nav filtering is a UX affordance and not a security boundary.
- [ ] The header shows `user.name` and `user.role_label`, and its sign-out button calls `logout()` from `AuthContext` — no second logout path exists.
- [ ] Exactly one nav item carries `aria-current="page"` at any time, driven by the same `isActive` flag as the highlight; `/dashboard` does not stay active on `/dashboard/admin`.
- [ ] Theme and direction live in one `UiPreferencesContext`; `LoginPage.tsx` no longer defines `getInitialTheme`, `getInitialLang`, or its own toggles, and its **12** tests still pass unchanged.
- [ ] Nothing writes to `localStorage` on mount: with no prior choice, `resolvedTheme` follows `prefers-color-scheme` **and `localStorage.length` is `0`** — asserted. An explicit choice persists and overrides the OS in both directions.
- [ ] The provider subscribes to the media query's `change` event, so an OS theme flip is followed live while `theme === 'system'`.
- [ ] Below **1024px** the sidebar is a drawer opened by a labelled control with `aria-expanded`/`aria-controls`; it closes on selection, on `Escape`, and on backdrop click; focus returns to the toggle; the body scroll lock is released on unmount.
- [ ] The drawer slides in from the correct edge under **both** `dir="ltr"` and `dir="rtl"` — the physical `translateX` is mirrored explicitly, not left to logical properties.
- [ ] The page body has no horizontal scrollbar at any width from 360px up; `.shell-main` carries `min-inline-size: 0`.
- [ ] Layout uses logical properties (`border-inline-end`, `padding-inline`, `inset-inline-start`) throughout — no `margin-left`/`border-right` in shell CSS — and the `⌘K` badge keeps `direction: ltr`.
- [ ] A skip link is the first focusable element; every nav item and enabled control has a visible focus ring; **no `outline: none` without a replacement in the same rule** appears anywhere in this story's CSS.
- [ ] The drawer transition and the skeleton shimmer are both disabled under `prefers-reduced-motion: reduce`.
- [ ] `HeaderUserSkeleton` renders when `user` is `null` with the slot's dimensions reserved, and `AppLayout` does not crash in that state.
- [ ] The language and notification header slots exist, are visibly inert (`disabled`, `title="Coming soon"`), and carry a comment naming **WIS-11** and **WIS-13** as their owners; the bell's dot is `aria-hidden`.
- [ ] Shell tokens live in `web/src/index.css` as custom properties (including `--shell-breakpoint`), with the light values on bare `:root` and the dark values in **both** the `prefers-color-scheme` block and the `[data-theme="dark"]` block.
- [ ] `npm run build` and `npm run lint` are clean, and `ReactQueryDevtools` is absent from `web/dist/assets/*.js`.
- [ ] `api/` is untouched and its **21** Pest tests still pass.
- [ ] `00-overview.md` and `00-index.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 03.**
