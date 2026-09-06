import type { ColumnDef } from '../../../components/data-table/types';
import { ArticleStatusBadge } from '../components/ArticleStatusBadge';
import { formatDate } from '../../../i18n';
import type { ArticleSummary } from './article';

export function formatArticleDate(iso: string | null): string {
  if (!iso) return '—';
  return formatDate(iso);
}

/**
 * The article list, built on Story 03's shared DataTable — the brief names
 * "Data table (Customers, Knowledge Base articles)" in one heading, so this is
 * one pattern across two screens, not a second table.
 */
export function makeArticleColumns(t: (key: string) => string): ColumnDef<ArticleSummary>[] {
  return [
    {
      id: 'title',
      header: t('columns.article'),
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
      header: t('columns.category'),
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
      header: t('columns.status'),
      width: '110px',
      sortKey: 'status',
      cell: (row) => <ArticleStatusBadge status={row.status} label={row.status_label} />,
    },
    {
      id: 'views',
      header: t('columns.views'),
      width: '90px',
      sortKey: 'view_count',
      align: 'end',
      // Numerals inside a table cell must not reverse under RTL.
      cell: (row) => <span dir="ltr">{row.view_count}</span>,
    },
    {
      id: 'updated_at',
      header: t('columns.updated'),
      width: '130px',
      sortKey: 'updated_at',
      cell: (row) => <span dir="ltr">{formatArticleDate(row.updated_at)}</span>,
    },
  ];
}
