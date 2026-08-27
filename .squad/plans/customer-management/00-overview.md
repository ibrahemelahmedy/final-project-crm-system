# customer-management — plan overview

Entry point for the **customer-management** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 03 | [03-story-customer-management.md](03-story-customer-management.md) | Customer Management | WIS-4 | Story 01 (authentication), Story 02 (app-shell) |

## Dependency notes

**This feature owns the `customers` entity for the whole project.** Story 04 (Ticket
Management, WIS-2) puts a foreign key on it, and Stories 05, 07, 12 and 13 read customer
data through the resource defined here. Story 03 therefore lands before Story 04.

- **Depends on** [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md):
  `UserRole`, `User::canSeeTeamQueue()` (which `CustomerPolicy` delegates to), the
  `auth:sanctum` route group, and the shared Axios instance / `QueryClient` on the frontend.
  No auth change is required — every new endpoint goes inside the existing group.
- **Depends on** [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md):
  the `/customers` placeholder route this story replaces (`web/src/App.tsx` line 46), the
  `Customers` nav entry (already present at `navItems.tsx` lines 48–56 — **this story does not
  edit the nav manifest**), the `.shell-main` content container, and the four-block token
  structure in `web/src/index.css`.
- **Read-relationship to Story 04 (WIS-2)**, not a build-order dependency: the customer
  profile's interaction-history panel queries the `tickets` table live through a
  `Schema::hasColumn('tickets', 'customer_id')` guard. Until Story 04 lands it returns an
  empty page carrying `meta.pending_story: "WIS-2"`, and the UI shows a pending notice rather
  than an empty state. **Nothing about tickets is denormalized onto `customers`.**

### Shared contracts this story establishes

Later stories consume these rather than redefining them. The authoritative definitions live
in the plan's **"Contract owned by this story"** section (C1–C7).

- **`customers` table (C1)** — `id · name · email · phone · phone_normalized · company · tier ·
  last_contact_at · created_by · deleted_at · timestamps`, soft-deleted, with two **partial
  unique indexes** on `email` and `phone_normalized` (C2). Story 04 adds
  `foreignId('customer_id')->constrained('customers')->restrictOnDelete()` in **its own**
  migration and adds `Customer::tickets()` at the same time; it never edits this story's
  migration. `last_contact_at` is written by Story 05.
- **`CustomerResource` JSON (C4)** — `id · name · email · phone · company · tier · tier_label ·
  initials · open_tickets_count · last_contact_at · created_at · updated_at`.
  `phone_normalized`, `created_by`, and `deleted_at` are never exposed.
  `open_tickets_count` returns `0` until Story 04 adds the FK; its definition (status not in
  `resolved`/`closed`) is pinned in C5 and Story 04 swaps the literal for its `TicketStatus`
  enum without renaming the key.
- **`App\Enums\CustomerTier`** — `standard · premium · enterprise`, with `label()` and
  `values()`. The only definition of those three strings.
- **`CustomerPolicy`** — create/update for every authenticated role; delete and every bulk
  action gated on `User::canSeeTeamQueue()`.
- **`/api/customers*` routes (C6)** — list, facets, CRUD, bulk, ticket history, notes,
  attachments. **No other story adds a `/api/customers*` route.**
- **`web/src/components/data-table/`** — the generic `DataTable`, its skeleton/empty/error
  states, pagination, column menu, and bulk-action bar, with the `ColumnDef<T>` /
  `DataTableProps<T>` surface frozen. **Story 09 (Knowledge Base, WIS-5) consumes this
  unchanged**; it must not fork or re-implement the table.
- **`web/src/components/ui/Modal.tsx` and `ConfirmDialog.tsx`** — the project's first modal and
  destructive-confirmation patterns (portal, focus trap, Escape, scroll-lock release on
  unmount, confirm text naming the specific record or the exact count). Stories 06, 08, 09 and
  10 reuse these instead of writing their own.
- **`useCustomerSearch`**, exported from `features/customers/index.ts` — the customer typeahead
  Story 04's New Ticket modal uses to pick a customer.
- **`api/config/attachments.php`** — the size cap and allowed extensions. Story 05's message
  attachments read the same config rather than defining a second policy.

### Routes added

`/customers` (replaces the `PagePlaceholder`) and `/customers/:customerId`. The profile route is
deliberately **not** a nav item, so the `navItems` sweep in
`web/src/app/navigation/navRoutes.test.tsx` stays valid unchanged.
