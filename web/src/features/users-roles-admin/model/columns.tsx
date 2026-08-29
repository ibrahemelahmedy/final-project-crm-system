import type { ColumnDef } from '../../../components/data-table/types';
import { RoleBadge } from '../components/RoleBadge';
import { StatusPill } from '../components/StatusPill';
import { UserAvatar } from '../components/UserAvatar';
import type { AdminUser } from './adminUser';
import { formatLastActive } from './relativeTime';

/**
 * The six columns from WisalUsers-LightLTR.dc.html, in the design's order:
 * USER · EMAIL · ROLE · STATUS · DEPARTMENT · LAST ACTIVE.
 *
 * Widths match the design's grid track list (2fr 1.5fr 1fr 100px 1fr 120px);
 * the leading 32px checkbox track belongs to the shared DataTable, not here.
 *
 * EMAIL and STATUS omit `sortKey` — neither is a server-whitelisted sort
 * column, and a header that looks sortable but is not is worse than a plain
 * one.
 */
export const userColumns: ColumnDef<AdminUser>[] = [
  {
    id: 'name',
    header: 'USER',
    width: '2fr',
    sortKey: 'name',
    locked: true,
    cell: (row) => (
      <span className="dt-name-cell">
        <UserAvatar initials={row.initials} id={row.id} />
        {row.name}
      </span>
    ),
  },
  {
    id: 'email',
    header: 'EMAIL',
    width: '1.5fr',
    cell: (row) => (
      <span style={{ color: 'var(--text-muted)' }} dir="ltr">
        {row.email}
      </span>
    ),
  },
  {
    id: 'role',
    header: 'ROLE',
    width: '1fr',
    sortKey: 'role',
    cell: (row) => <RoleBadge role={row.role} label={row.role_label} />,
  },
  {
    id: 'status',
    header: 'STATUS',
    width: '100px',
    cell: (row) => <StatusPill isActive={row.is_active} />,
  },
  {
    id: 'department',
    header: 'DEPARTMENT',
    width: '1fr',
    sortKey: 'department',
    // `department` is nullable and backfilled empty — an em dash until an
    // Administrator sets one.
    cell: (row) => <span style={{ color: 'var(--text-muted)' }}>{row.department ?? '—'}</span>,
  },
  {
    id: 'last_active',
    header: 'LAST ACTIVE',
    width: '120px',
    sortKey: 'last_login_at',
    cell: (row) => (
      <span style={{ color: 'var(--text-muted)' }} title={row.last_login_at ?? 'Never signed in'}>
        {formatLastActive(row.last_login_at)}
      </span>
    ),
  },
];

/** Row-action callbacks the ACTIONS column needs. */
export type UserRowActions = {
  onEdit: (user: AdminUser) => void;
  onDeactivate: (user: AdminUser) => void;
  onActivate: (user: AdminUser) => void;
  /** The signed-in Administrator, who cannot deactivate themselves. */
  currentUserId: number;
};

/**
 * The design's six columns plus an ACTIONS column.
 *
 * ACTIONS is last in the array and carries `align: 'end'`, which is a LOGICAL
 * alignment — the shared DataTable emits `text-align: end` and one
 * grid-template-columns list, so under `dir="rtl"` the column mirrors to the
 * visual left with no RTL-specific track list anywhere. That is the brief's
 * data-table rule, satisfied by not fighting it.
 *
 * There is no Delete action, ever. Deactivation only, so historical ticket and
 * audit rows stay attributed — the API exposes no delete route to call.
 */
export function buildUserColumns(actions: UserRowActions): ColumnDef<AdminUser>[] {
  return [
    ...userColumns,
    {
      id: 'actions',
      header: 'ACTIONS',
      width: '150px',
      align: 'end',
      // Never hidden by the column menu — with it hidden there is no way to
      // edit or deactivate anyone.
      locked: true,
      cell: (row) => (
        <span
          className="user-row-actions"
          // The row itself is clickable (it opens the edit modal), so the
          // buttons must not bubble a second activation.
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="dt-btn dt-btn-outline dt-btn-sm fv"
            onClick={() => actions.onEdit(row)}
          >
            Edit
          </button>
          {row.is_active ? (
            <button
              type="button"
              className="dt-btn dt-btn-danger-outline dt-btn-sm fv"
              disabled={row.id === actions.currentUserId}
              title={
                row.id === actions.currentUserId
                  ? 'You cannot deactivate your own account'
                  : `Deactivate ${row.name}`
              }
              onClick={() => actions.onDeactivate(row)}
            >
              Deactivate
            </button>
          ) : (
            <button
              type="button"
              className="dt-btn dt-btn-outline dt-btn-sm fv"
              title={`Reactivate ${row.name}`}
              onClick={() => actions.onActivate(row)}
            >
              Activate
            </button>
          )}
        </span>
      ),
    },
  ];
}
