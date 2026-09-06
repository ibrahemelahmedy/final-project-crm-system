import type { ColumnDef } from '../../../components/data-table/types';
import { CustomerAvatar } from '../components/CustomerAvatar';
import { CustomerTierBadge } from '../components/CustomerTierBadge';
import { formatDate } from '../../../i18n';
import type { Customer } from './customer';

export function formatLastContact(iso: string | null): string {
  if (!iso) return '—';
  return formatDate(iso);
}

export function makeCustomerColumns(t: (key: string) => string): ColumnDef<Customer>[] {
  return [
    {
      id: 'name',
      header: t('columns.customer'),
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
      header: t('columns.email'),
      width: '1.6fr',
      cell: (row) => <span style={{ color: 'var(--text-muted)' }}>{row.email ?? '—'}</span>,
    },
    {
      id: 'company',
      header: t('columns.company'),
      width: '1fr',
      sortKey: 'company',
      cell: (row) => row.company ?? '—',
    },
    {
      id: 'open',
      header: t('columns.open'),
      width: '90px',
      sortKey: 'open_tickets_count',
      align: 'end',
      cell: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.open_tickets_count}</span>
      ),
    },
    {
      id: 'last_contact',
      header: t('columns.lastContact'),
      width: '110px',
      sortKey: 'last_contact_at',
      cell: (row) => <span dir="ltr">{formatLastContact(row.last_contact_at)}</span>,
    },
    {
      id: 'tier',
      header: t('columns.tier'),
      width: '100px',
      cell: (row) => <CustomerTierBadge tier={row.tier} label={row.tier_label} />,
    },
  ];
}
