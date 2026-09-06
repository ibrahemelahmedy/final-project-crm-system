import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../../../components/data-table/DataTable';
import { DataTableSkeleton } from '../../../components/data-table/DataTableSkeleton';
import { DataTableEmpty } from '../../../components/data-table/DataTableEmpty';
import { DataTableError } from '../../../components/data-table/DataTableError';
import { Pagination } from '../../../components/data-table/Pagination';
import type { ColumnDef } from '../../../components/data-table/types';
import { useT, formatDateTime } from '../../../i18n';
import { useAuditLogParams } from '../hooks/useAuditLogParams';
import { useAuditLogFacets, useAuditLogs } from '../hooks/useAuditLogs';
import { FilterChip } from '../components/FilterChip';
import type { AuditLogEntry } from '../model/adminUser';

/**
 * The audit-log viewer.
 *
 * There is NO edit or delete affordance anywhere on this page, and there is
 * nothing to add one to: the API exposes no write verb on an audit row, the
 * AuditLog model rejects update() and delete(), and on PostgreSQL a trigger
 * rejects them again. This component is read-only by construction, not by
 * omission.
 *
 * Pagination is server-side and mandatory — the log grows unbounded.
 */
function makeAuditColumns(t: (key: string) => string): ColumnDef<AuditLogEntry>[] {
  return [
    {
      id: 'created_at',
      header: t('auditLog.columns.when'),
      width: '170px',
      locked: true,
      cell: (row) => <span dir="ltr">{row.created_at ? formatDateTime(row.created_at) : '—'}</span>,
    },
    {
      id: 'actor',
      header: t('auditLog.columns.actor'),
      width: '1.4fr',
      // A deleted actor keeps the retained email (audit_logs.user_id is
      // nullOnDelete), which the resource already resolves into actor.name.
      cell: (row) => (
        <span className="audit-actor">
          <span>{row.actor.name}</span>
          {row.actor.id === null && <span className="audit-actor-note">{t('auditLog.noLongerUser')}</span>}
        </span>
      ),
    },
    {
      id: 'event',
      header: t('auditLog.columns.action'),
      width: '1.2fr',
      cell: (row) => <span className="audit-event">{row.event_label}</span>,
    },
    {
      id: 'target',
      header: t('auditLog.columns.target'),
      width: '1.4fr',
      cell: (row) => (
        <span style={{ color: 'var(--text-muted)' }}>
          {row.target.label ?? (row.target.id !== null ? `#${row.target.id}` : '—')}
        </span>
      ),
    },
    {
      id: 'ip',
      header: t('auditLog.columns.ip'),
      width: '130px',
      cell: (row) => (
        <span style={{ color: 'var(--text-muted)' }} dir="ltr">
          {row.ip_address ?? '—'}
        </span>
      ),
    },
  ];
}

export const AuditLogPage: React.FC = () => {
  const { t } = useT('users');
  const auditColumns = useMemo(() => makeAuditColumns(t), [t]);
  const [params, setParams, isFiltered] = useAuditLogParams();
  const { data, isLoading, isError, refetch, isPlaceholderData } = useAuditLogs(params);
  const { data: facets } = useAuditLogFacets();

  // The viewer has no bulk actions — nothing here can be acted on — so the
  // shared DataTable's selection is held locally and never read.
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const actorOptions = useMemo(
    () => (facets?.actors ?? []).map((a) => ({ value: String(a.value), label: a.label })),
    [facets]
  );

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <div className="audit-log-page">
      <div className="page-title-row">
        <div>
          <h1>{t('auditLog.title')}</h1>
          <p className="page-subtitle">{t('auditLog.subtitle')}</p>
        </div>
        <div className="page-title-actions">
          <Link to="/users" className="dt-btn dt-btn-outline fv">
            {t('auditLog.backToUsers')}
          </Link>
        </div>
      </div>

      <div className="toolbar-row">
        <div className="facet-row">
          <FilterChip
            label={t('auditLog.filterActor')}
            mode="single"
            options={actorOptions}
            selected={params.actor_id ? [String(params.actor_id)] : []}
            emptySummary={t('auditLog.anyActor')}
            onChange={([actorId]) => setParams({ actor_id: actorId ? Number(actorId) : null })}
          />
          <FilterChip
            label={t('auditLog.filterAction')}
            mode="multi"
            options={(facets?.events ?? []).map((e) => ({
              value: e.value,
              label: e.label,
              count: e.count,
            }))}
            selected={params.event}
            onChange={(event) => setParams({ event })}
          />
          <label className="date-range-field">
            <span>{t('auditLog.from')}</span>
            <input
              type="date"
              value={params.from}
              max={params.to || undefined}
              onChange={(e) => setParams({ from: e.target.value })}
            />
          </label>
          <label className="date-range-field">
            <span>{t('auditLog.to')}</span>
            <input
              type="date"
              value={params.to}
              min={params.from || undefined}
              onChange={(e) => setParams({ to: e.target.value })}
            />
          </label>
          {isFiltered && (
            <button
              type="button"
              className="dt-btn dt-btn-outline dt-btn-sm fv"
              onClick={() => setParams({ actor_id: null, event: [], from: '', to: '', q: '' })}
            >
              {t('auditLog.clearFilters')}
            </button>
          )}
        </div>
      </div>

      <div className="table-card" style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
        {isLoading ? (
          <DataTableSkeleton columns={auditColumns} />
        ) : isError ? (
          <DataTableError onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          isFiltered ? (
            <DataTableEmpty
              title={t('auditLog.emptyFilteredTitle')}
              body={t('auditLog.emptyFilteredBody')}
              actions={[
                {
                  label: t('auditLog.clearFilters'),
                  variant: 'outline',
                  onClick: () => setParams({ actor_id: null, event: [], from: '', to: '', q: '' }),
                },
              ]}
            />
          ) : (
            <DataTableEmpty
              title={t('auditLog.emptyTitle')}
              body={t('auditLog.emptyBody')}
            />
          )
        ) : (
          <>
            <DataTable
              rows={rows}
              columns={auditColumns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => t('auditLog.rowLabel', { event: row.event_label, actor: row.actor.name })}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              // Nothing on this page is sortable: the log is strictly newest
              // first, which is the only order an append-only trail has.
              sort={null}
              onSortChange={() => {}}
              caption={t('auditLog.caption')}
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
    </div>
  );
};
