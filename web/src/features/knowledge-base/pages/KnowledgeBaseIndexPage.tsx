import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../../components/data-table/DataTable';
import { DataTableSkeleton } from '../../../components/data-table/DataTableSkeleton';
import { DataTableEmpty } from '../../../components/data-table/DataTableEmpty';
import { DataTableError } from '../../../components/data-table/DataTableError';
import { Pagination } from '../../../components/data-table/Pagination';
import { BulkActionBar } from '../../../components/data-table/BulkActionBar';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useAuth } from '../../auth/AuthContext';
import { useT } from '../../../i18n';
import { useKbListParams } from '../hooks/useKbListParams';
import { useKbArticles, useKbCategories, useMostViewed } from '../hooks/useKbQueries';
import { useBulkArticleAction } from '../hooks/useKbMutations';
import { makeArticleColumns } from '../model/columns';
import { CategoryRail } from '../components/CategoryRail';
import { MostViewedList } from '../components/MostViewedList';
import type { ArticleStatus } from '../model/article';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

type BulkAction = 'publish' | 'unpublish' | 'archive';

function makeStatusFilters(t: (key: string) => string): { value: ArticleStatus; label: string }[] {
  return [
    { value: 'published', label: t('index.statusFilters.published') },
    { value: 'draft', label: t('index.statusFilters.draft') },
    { value: 'archived', label: t('index.statusFilters.archived') },
  ];
}

function makeBulkCopy(t: (key: string) => string): Record<BulkAction, { verb: string; body: string }> {
  return {
    publish: {
      verb: t('index.bulk.publishVerb'),
      body: t('index.bulk.publishBody'),
    },
    unpublish: {
      verb: t('index.bulk.unpublishVerb'),
      body: t('index.bulk.unpublishBody'),
    },
    archive: {
      verb: t('index.bulk.archiveVerb'),
      body: t('index.bulk.archiveBody'),
    },
  };
}

/**
 * The KB index — WisalKBIndex-*.dc.html.
 *
 * Category rail, "Most viewed", a search box, and the article list on Story
 * 03's shared DataTable with the same bulk-action bar. Every piece of filter
 * state lives in URL search params, so the Back button and a shared link work
 * exactly as they do on Customers.
 */
export const KnowledgeBaseIndexPage: React.FC = () => {
  const { t } = useT('knowledge');
  const articleColumns = useMemo(() => makeArticleColumns(t), [t]);
  const statusFilters = useMemo(() => makeStatusFilters(t), [t]);
  const bulkCopy = useMemo(() => makeBulkCopy(t), [t]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams, isFiltered] = useKbListParams();
  const [searchInput, setSearchInput] = useState(params.q);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const searchInitialised = useRef(false);

  const { data, isLoading, isError, refetch, isPlaceholderData } = useKbArticles(params);
  const categories = useKbCategories();
  const mostViewed = useMostViewed();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmBulk, setConfirmBulk] = useState<BulkAction | null>(null);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

  const bulk = useBulkArticleAction();
  const isEditor = user?.role === 'team_lead' || user?.role === 'administrator';

  // The search box writes with replace: true while typing — pushing a history
  // entry per keystroke makes Back unusable.
  useEffect(() => {
    if (!searchInitialised.current) {
      searchInitialised.current = true;
      return;
    }
    setParams({ q: debouncedSearch }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Selection is page-scoped: clear it whenever the filter/sort/page params
  // change, keyed off the serialised params rather than the rows array (which
  // changes identity on every background refetch).
  const serializedParams = JSON.stringify(params);
  useEffect(() => {
    setSelectedIds([]);
  }, [serializedParams]);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  const runBulk = async () => {
    if (!confirmBulk) return;
    const result = await bulk.mutateAsync({ action: confirmBulk, ids: selectedIds });
    // A silent count mismatch is worse than no feedback — name what was
    // skipped and why.
    setBulkNotice(
      result.skipped.length > 0
        ? t('index.bulk.notice', {
            affected: result.affected,
            count: result.skipped.length,
            names: result.skipped.map((s) => s.title).join(', '),
          })
        : null
    );
    setSelectedIds([]);
    setConfirmBulk(null);
  };

  const describeFilters = () => {
    const parts: string[] = [];
    if (params.category.length) {
      const names = params.category.map(
        (slug) => categories.data?.data.find((c) => c.slug === slug)?.name ?? slug
      );
      parts.push(`${t('index.filterCategory')}: ${names.join(', ')}`);
    }
    if (params.status.length) parts.push(`${t('index.filterStatus')}: ${params.status.join(', ')}`);
    if (params.q) parts.push(`"${params.q}"`);
    return parts.join(' · ');
  };

  return (
    <div className="kb-page">
      <div className="page-title-row">
        <div>
          <h1>{t('index.title')}</h1>
          {isLoading ? (
            <span className="sk" style={{ width: 90, height: 14, display: 'inline-block', marginTop: 2 }} />
          ) : (
            <p className="page-subtitle">{t('index.count', { count: categories.data?.total ?? total })}</p>
          )}
        </div>
        {isEditor && (
          <button
            type="button"
            className="dt-btn dt-btn-primary fv"
            onClick={() => navigate('/knowledge-base/new')}
          >
            {t('index.newArticle')}
          </button>
        )}
      </div>

      <div className="kb-searchbar">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3" />
        </svg>
        <input
          className="kb-searchbar-input fv"
          type="search"
          placeholder={t('index.searchPlaceholder')}
          aria-label={t('index.searchLabel')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className="kb-body">
        <aside className="kb-rail-col">
          <CategoryRail
            categories={categories.data?.data ?? []}
            total={categories.data?.total ?? 0}
            selected={params.category}
            onSelect={(category) => setParams({ category })}
            isLoading={categories.isLoading}
          />
          <MostViewedList articles={mostViewed.data ?? []} isLoading={mostViewed.isLoading} />
        </aside>

        <section className="kb-list-col">
          <div className="toolbar-row">
            {selectedIds.length > 0 ? (
              <BulkActionBar
                count={selectedIds.length}
                onClear={() => setSelectedIds([])}
                actions={(['publish', 'unpublish', 'archive'] as BulkAction[]).map((action) => ({
                  id: action,
                  label: bulkCopy[action].verb,
                  tone: action === 'archive' ? ('danger' as const) : undefined,
                  disabled: !isEditor,
                  title: isEditor ? undefined : t('index.bulkRestricted'),
                  onClick: () => setConfirmBulk(action),
                }))}
              />
            ) : (
              <div className="facet-row">
                {statusFilters.map((filter) => {
                  const active = params.status.includes(filter.value);
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      className="kb-status-filter fv"
                      data-active={active}
                      aria-pressed={active}
                      onClick={() =>
                        setParams({
                          status: active
                            ? params.status.filter((s) => s !== filter.value)
                            : [...params.status, filter.value],
                        })
                      }
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {bulkNotice && (
            <p className="kb-bulk-notice" role="status">
              {bulkNotice}
            </p>
          )}

          <div className="table-card" style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
            {isLoading ? (
              <DataTableSkeleton columns={articleColumns} />
            ) : isError ? (
              <DataTableError message={t('index.loadError')} onRetry={() => refetch()} />
            ) : rows.length === 0 ? (
              isFiltered ? (
                // The Empty state suggests broadening the search and quotes
                // the query back — never a blank list.
                <DataTableEmpty
                  title={params.q ? t('index.emptyFilteredTitleQuery', { query: params.q }) : t('index.emptyFilteredTitle')}
                  body={t('index.emptyFilteredBody', { filters: describeFilters() })}
                  actions={[
                    {
                      label: t('index.clearFilters'),
                      variant: 'outline',
                      onClick: () => {
                        setSearchInput('');
                        setParams({ q: '', category: [], status: [] });
                      },
                    },
                    ...(isEditor
                      ? [
                          {
                            label: t('index.newArticle'),
                            variant: 'primary' as const,
                            onClick: () => navigate('/knowledge-base/new'),
                          },
                        ]
                      : []),
                  ]}
                />
              ) : (
                <DataTableEmpty
                  title={t('index.emptyTitle')}
                  body={isEditor ? t('index.emptyBodyEditor') : t('index.emptyBodyViewer')}
                  actions={
                    isEditor
                      ? [
                          {
                            label: t('index.newArticle'),
                            variant: 'primary',
                            onClick: () => navigate('/knowledge-base/new'),
                          },
                        ]
                      : []
                  }
                />
              )
            ) : (
              <>
                <DataTable
                  rows={rows}
                  columns={articleColumns}
                  getRowId={(row) => row.id}
                  getRowLabel={(row) => row.title}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  sort={{ key: params.sort, dir: params.dir }}
                  onSortChange={(key) =>
                    setParams(
                      { sort: key, dir: params.sort === key && params.dir === 'asc' ? 'desc' : 'asc' },
                      { resetPage: true }
                    )
                  }
                  onRowActivate={(row) => navigate(`/knowledge-base/${row.slug}`)}
                  caption={t('index.caption')}
                />
                <Pagination
                  currentPage={data?.meta.current_page ?? 1}
                  lastPage={data?.meta.last_page ?? 1}
                  total={total}
                  perPage={data?.meta.per_page ?? params.per_page}
                  onPageChange={(page) => setParams({ page }, { resetPage: false })}
                />
              </>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmBulk !== null}
        title={
          confirmBulk
            ? t('index.bulk.confirmTitle', { verb: bulkCopy[confirmBulk].verb, count: selectedIds.length })
            : ''
        }
        body={confirmBulk ? bulkCopy[confirmBulk].body : ''}
        confirmLabel={confirmBulk ? bulkCopy[confirmBulk].verb : ''}
        tone={confirmBulk === 'archive' ? 'danger' : undefined}
        isPending={bulk.isPending}
        onCancel={() => setConfirmBulk(null)}
        onConfirm={runBulk}
      />
    </div>
  );
};
