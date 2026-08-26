# app-shell — plan overview

Entry point for the **app-shell** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 02 | [02-story-application-shell-navigation.md](02-story-application-shell-navigation.md) | Application Shell & Navigation | WIS-10 | Story 01 (authentication) |

## Dependency notes

**This feature blocks every other UI story.** WIS-2 through WIS-9, WIS-13 and WIS-15
all render inside the shell built here, so Story 02 lands immediately after Story 01
and before any feature screen.

- **Depends on** [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md):
  the shell only renders for an authenticated user and reads `user.name` / `user.role_label`
  from `AuthContext`, and its sign-out calls that context's `logout()`. No new API endpoint —
  `GET /api/user` and `POST /api/logout` already exist.
- **Shared contracts this story establishes**, which later stories consume rather than redefine:
  - `web/src/app/navigation/navItems.tsx` — the single source of truth for sidebar labels, paths,
    icons, and role visibility. A feature story adding a screen edits this manifest; it does not
    hard-code a nav entry in a component.
  - `web/src/app/providers/UiPreferencesContext.tsx` — theme and direction for the whole app,
    extracted out of `LoginPage.tsx`. No screen implements its own theme toggle.
  - Shell tokens and `--shell-breakpoint` (**1024px**) in `web/src/index.css`.
- **Slots reserved but not implemented here:** the header's language switcher (**WIS-11**) and
  notification bell (**WIS-13**) ship inert. Those stories fill the existing slots without
  restructuring the header.
- **Placeholder routes created here** — `/customers`, `/knowledge-base`, `/channels`, `/reports`,
  `/sla-rules`, `/users` — each render a `PagePlaceholder` that the owning feature story replaces.
