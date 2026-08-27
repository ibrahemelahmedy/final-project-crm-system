import type { ColumnDef } from '../../../components/data-table/types';
import { CustomerAvatar } from '../components/CustomerAvatar';
import { CustomerTierBadge } from '../components/CustomerTierBadge';
import type { Customer } from './customer';

// Intl.DateTimeFormat, never a hand-rolled month array — Story 15 switches
// the locale and a hard-coded ['Jan', 'Feb', …] cannot follow it.
const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function formatLastContact(iso: string | null): string {
  if (!iso) return '—';
  return dateFormatter.format(new Date(iso));
}

export const customerColumns: ColumnDef<Customer>[] = [
  {
    id: 'name',
    header: 'CUSTOMER',
    width: '2fr',
    sortKey: 'name',
    locked: true,
    cell: (row) => (
      <span className="dt-name-cell">
        <CustomerAvatar initials={row.initials} />
        {row.name}
      </span>
    ),
  },
  {
    id: 'email',
    header: 'EMAIL',
    width: '1.6fr',
    cell: (row) => <span style={{ color: 'var(--text-muted)' }}>{row.email ?? '—'}</span>,
  },
  {
    id: 'company',
    header: 'COMPANY',
    width: '1fr',
    sortKey: 'company',
    cell: (row) => row.company ?? '—',
  },
  {
    id: 'open',
    header: 'OPEN',
    width: '90px',
    sortKey: 'open_tickets_count',
    align: 'end',
    cell: (row) => (
      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.open_tickets_count}</span>
    ),
  },
  {
    id: 'last_contact',
    header: 'LAST CONTACT',
    width: '110px',
    sortKey: 'last_contact_at',
    cell: (row) => <span dir="ltr">{formatLastContact(row.last_contact_at)}</span>,
  },
  {
    id: 'tier',
    header: 'TIER',
    width: '100px',
    cell: (row) => <CustomerTierBadge tier={row.tier} label={row.tier_label} />,
  },
];
