import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../../components/data-table/DataTable';
import { DataTableSkeleton } from '../../../components/data-table/DataTableSkeleton';
import { DataTableEmpty } from '../../../components/data-table/DataTableEmpty';
import { DataTableError } from '../../../components/data-table/DataTableError';
import { Pagination } from '../../../components/data-table/Pagination';
import { ColumnMenu } from '../../../components/data-table/ColumnMenu';
import { BulkActionBar } from '../../../components/data-table/BulkActionBar';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useAuth } from '../../auth/AuthContext';
import { useT } from '../../../i18n';
import { useCustomerListParams } from '../hooks/useCustomerListParams';
import { useCustomers } from '../hooks/useCustomers';
import { useCustomerFacets } from '../hooks/useCustomerFacets';
import { useColumnPreferences } from '../hooks/useColumnPreferences';
import { useBulkCustomerAction } from '../hooks/useCustomerMutations';
import { makeCustomerColumns } from '../model/columns';
import { FacetFilter } from '../components/FacetFilter';
import { CustomerFormModal } from '../components/CustomerFormModal';
import type { CustomerTier } from '../model/customer';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function describeFilters(
  params: { q: string; company: string[]; tier: string[] },
  t: (key: string) => string
): string {
  const parts: string[] = [];
  if (params.company.length) parts.push(`${t('list.filterCompany')}: ${params.company.join(', ')}`);
  if (params.tier.length) parts.push(`${t('list.filterTier')}: ${params.tier.join(', ')}`);
  if (params.q) parts.push(`"${params.q}"`);
  return parts.join(' · ');
}

export const CustomersPage: React.FC = () => {
  const { t } = useT('customers');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams, isFiltered] = useCustomerListParams();
  const [searchInput, setSearchInput] = useState(params.q);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const searchInitialised = useRef(false);

  const { data, isLoading, isError, refetch, isPlaceholderData } = useCustomers(params);
  const { data: facets } = useCustomerFacets(params);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<{ action: 'delete' | 'set_tier'; tier?: CustomerTier } | null>(
    null
  );

  const bulk = useBulkCustomerAction();
  const canSeeTeamQueue = user?.role === 'team_lead' || user?.role === 'administrator';

  const customerColumns = useMemo(() => makeCustomerColumns(t), [t]);
  const { columns, allColumns, hidden, toggleHidden, moveColumn } = useColumnPreferences(
    user?.id ?? 0,
    customerColumns
  );

  // The search box writes with replace: true while typing — pushing a
  // history entry per keystroke makes Back unusable.
  useEffect(() => {
    if (!searchInitialised.current) {
      searchInitialised.current = true;
      return;
    }
    setParams({ q: debouncedSearch }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Selection is page-scoped: clear it whenever the filter/sort/page params
  // change, keyed off the serialised params rather than the rows array
  // (which changes identity on every background refetch).
  const serializedParams = JSON.stringify(params);
  useEffect(() => {
    setSelectedIds([]);
  }, [serializedParams]);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  const bulkTargets = rows.filter((r) => selectedIds.includes(r.id));

  const runBulk = async () => {
    if (!confirmBulk) return;
    if (confirmBulk.action === 'delete') {
      await bulk.mutateAsync({ action: 'delete', ids: selectedIds });
    } else {
      await bulk.mutateAsync({ action: 'set_tier', ids: selectedIds, tier: confirmBulk.tier! });
    }
    setSelectedIds([]);
    setConfirmBulk(null);
  };

  const bulkTitle = (() => {
    if (!confirmBulk) return '';
    const n = selectedIds.length;
    if (confirmBulk.action === 'delete') {
      return t('list.bulk.deleteConfirmTitle', { count: n });
    }
    const tierLabel = bulkTargets[0]?.tier_label ?? confirmBulk.tier;
    return t('list.bulk.setTierConfirmTitle', { count: n, tier: tierLabel });
  })();

  return (
    <div className="customers-page">
      <div className="page-title-row">
        <div>
          <h1>{t('list.title')}</h1>
          {isLoading ? (
            <span className="sk" style={{ width: 90, height: 14, display: 'inline-block', marginTop: 2 }} />
          ) : (
            <p className="page-subtitle">{t('list.count', { count: total })}</p>
          )}
        </div>
        <button type="button" className="dt-btn dt-btn-primary fv" onClick={() => setCreateOpen(true)}>
          {t('list.addCustomer')}
        </button>
      </div>

      <div className="toolbar-row">
        {selectedIds.length > 0 ? (
          // Occupies the facet-chip row's slot — it must not push the table
          // down abruptly, and the search box / column menu stay in place
          // beside it so a selection in progress does not block filtering.
          <BulkActionBar
            count={selectedIds.length}
            onClear={() => setSelectedIds([])}
            actions={[
              {
                id: 'delete',
                label: t('list.bulk.delete'),
                tone: 'danger',
                disabled: !canSeeTeamQueue,
                title: canSeeTeamQueue ? undefined : t('list.bulk.deleteRestricted'),
                onClick: () => setConfirmBulk({ action: 'delete' }),
              },
              {
                id: 'tag',
                label: t('list.bulk.tag'),
                disabled: !canSeeTeamQueue,
                title: canSeeTeamQueue ? undefined : t('list.bulk.tierRestricted'),
                onClick: () => setConfirmBulk({ action: 'set_tier', tier: 'enterprise' }),
              },
              { id: 'export', label: t('list.bulk.export'), disabled: true, title: t('list.bulk.comingSoon'), onClick: () => {} },
            ]}
          />
        ) : isLoading ? (
          <div className="facet-row">
            <span className="sk" style={{ width: 110, height: 28, borderRadius: 8 }} />
            <span className="sk" style={{ width: 130, height: 28, borderRadius: 8 }} />
          </div>
        ) : (
          <div className="facet-row">
            <FacetFilter
              label={t('list.filterCompany')}
              options={(facets?.companies ?? []).map((c) => ({ value: c.value, label: c.value, count: c.count }))}
              selected={params.company}
              onChange={(company) => setParams({ company })}
            />
            <FacetFilter
              label={t('list.filterTier')}
              options={(facets?.tiers ?? []).map((tierFacet) => ({ value: tierFacet.value, label: tierFacet.label, count: tierFacet.count }))}
              selected={params.tier}
              onChange={(tier) => setParams({ tier: tier as CustomerTier[] })}
            />
          </div>
        )}

        <div className="toolbar-row-end">
          <input
            className="search-input"
            type="search"
            placeholder={t('list.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label={t('list.searchLabel')}
          />
          <ColumnMenu columns={allColumns} hidden={hidden} onToggleHidden={toggleHidden} onMove={moveColumn} />
        </div>
      </div>

      <div className="table-card" style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
        {isLoading ? (
          <DataTableSkeleton columns={columns} />
        ) : isError ? (
          <DataTableError onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          isFiltered ? (
            <DataTableEmpty
              title={t('list.emptyFilteredTitle')}
              body={t('list.emptyFilteredBody', { filters: describeFilters(params, t) })}
              actions={[
                { label: t('list.resetFilters'), variant: 'outline', onClick: () => setParams({ q: '', company: [], tier: [] }) },
                { label: t('list.addCustomer'), variant: 'primary', onClick: () => setCreateOpen(true) },
              ]}
            />
          ) : (
            <DataTableEmpty
              title={t('list.emptyTitle')}
              body={t('list.emptyBody')}
              actions={[{ label: t('list.addCustomer'), variant: 'primary', onClick: () => setCreateOpen(true) }]}
            />
          )
        ) : (
          <>
            <DataTable
              rows={rows}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.name}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              sort={{ key: params.sort, dir: params.dir }}
              onSortChange={(key) =>
                setParams(
                  { sort: key, dir: params.sort === key && params.dir === 'asc' ? 'desc' : 'asc' },
                  { resetPage: true }
                )
              }
              onRowActivate={(row) => navigate(`/customers/${row.id}`)}
              caption={t('list.caption')}
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

      <CustomerFormModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <ConfirmDialog
        open={confirmBulk !== null}
        title={bulkTitle}
        body={
          confirmBulk?.action === 'delete'
            ? t('list.bulk.deleteBody')
            : t('list.bulk.tierBody')
        }
        confirmLabel={confirmBulk?.action === 'delete' ? t('list.bulk.delete') : t('list.bulk.setTier')}
        tone={confirmBulk?.action === 'delete' ? 'danger' : undefined}
        isPending={bulk.isPending}
        onCancel={() => setConfirmBulk(null)}
        onConfirm={runBulk}
      />
    </div>
  );
};
