import type { ColumnDef } from '../../../components/data-table/types';
import { ArticleStatusBadge } from '../components/ArticleStatusBadge';
import type { ArticleSummary } from './article';

// Intl.DateTimeFormat, never a hand-rolled month array — Story 15 switches the
// locale and a hard-coded ['Jan', 'Feb', …] cannot follow it. Same reasoning
// as Story 03's customer columns.
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatArticleDate(iso: string | null): string {
  if (!iso) return '—';
  return dateFormatter.format(new Date(iso));
}

/**
 * The article list, built on Story 03's shared DataTable — the brief names
 * "Data table (Customers, Knowledge Base articles)" in one heading, so this is
 * one pattern across two screens, not a second table.
 */
export const articleColumns: ColumnDef<ArticleSummary>[] = [
  {
    id: 'title',
    header: 'ARTICLE',
    width: '2.4fr',
    sortKey: 'title',
    locked: true,
    cell: (row) => (
      <span className="kb-title-cell">
        <span className="kb-title-cell-title">{row.title}</span>
        {row.excerpt && <span className="kb-title-cell-excerpt">{row.excerpt}</span>}
      </span>
    ),
  },
  {
    id: 'category',
    header: 'CATEGORY',
    width: '1fr',
    cell: (row) =>
      row.category ? (
        // The uppercase eyebrow from the artboard's article card.
        <span className="kb-category-eyebrow">{row.category.name}</span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      ),
  },
  {
    id: 'status',
    header: 'STATUS',
    width: '110px',
    sortKey: 'status',
    cell: (row) => <ArticleStatusBadge status={row.status} label={row.status_label} />,
  },
  {
    id: 'views',
    header: 'VIEWS',
    width: '90px',
    sortKey: 'view_count',
    align: 'end',
    // Numerals inside a table cell must not reverse under RTL.
    cell: (row) => <span dir="ltr">{row.view_count}</span>,
  },
  {
    id: 'updated_at',
    header: 'UPDATED',
    width: '130px',
    sortKey: 'updated_at',
    cell: (row) => <span dir="ltr">{formatArticleDate(row.updated_at)}</span>,
  },
];
