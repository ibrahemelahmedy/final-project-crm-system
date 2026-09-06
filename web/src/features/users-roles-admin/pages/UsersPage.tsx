import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../../../components/data-table/DataTable';
import { DataTableSkeleton } from '../../../components/data-table/DataTableSkeleton';
import { DataTableEmpty } from '../../../components/data-table/DataTableEmpty';
import { DataTableError } from '../../../components/data-table/DataTableError';
import { Pagination } from '../../../components/data-table/Pagination';
import { useAuth } from '../../auth/AuthContext';
import { useT } from '../../../i18n';
import { useUserListParams } from '../hooks/useUserListParams';
import { useUserFacets, useUsers } from '../hooks/useUsers';
import { useActivateUser } from '../hooks/useUserMutations';
import { buildUserColumns } from '../model/columns';
import { ROLE_LABEL_KEYS, type AdminUser, type UserRole, type UserStatusFilter } from '../model/adminUser';
import { FilterChip } from '../components/FilterChip';
import { UserFormModal } from '../components/UserFormModal';
import { DeactivateUserDialog } from '../components/DeactivateUserDialog';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function makeStatusOptions(t: (key: string) => string) {
  return [
    { value: 'active', label: t('status.active') },
    { value: 'inactive', label: t('status.inactive') },
    { value: 'all', label: t('status.all') },
  ];
}

function describeFilters(
  params: { q: string; role: UserRole[]; department: string[]; status: UserStatusFilter },
  t: (key: string) => string
): string {
  const parts: string[] = [];
  if (params.role.length) {
    parts.push(`${t('list.filterRole')}: ${params.role.map((r) => t(ROLE_LABEL_KEYS[r])).join(', ')}`);
  }
  if (params.department.length) parts.push(`${t('list.filterDepartment')}: ${params.department.join(', ')}`);
  if (params.status !== 'active') {
    parts.push(`${t('list.filterStatus')}: ${params.status === 'all' ? t('status.all') : t('status.inactive')}`);
  }
  if (params.q) parts.push(`"${params.q}"`);
  return parts.join(' · ');
}

/**
 * The Users screen — WisalUsers-LightLTR.dc.html.
 *
 * Uses Story 03's shared DataTable and its server-side pagination /
 * faceted-filter / URL-filter-state pattern. There is no second table
 * implementation and no client-side paging or filtering anywhere on this page.
 */
export const UsersPage: React.FC = () => {
  const { t } = useT('users');
  const { user: currentUser } = useAuth();
  const [params, setParams, isFiltered] = useUserListParams();
  const [searchInput, setSearchInput] = useState(params.q);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const searchInitialised = useRef(false);

  const { data, isLoading, isError, refetch, isPlaceholderData } = useUsers(params);
  const { data: facets } = useUserFacets();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deactivating, setDeactivating] = useState<AdminUser | null>(null);

  const activate = useActivateUser();

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

  const statusOptions = useMemo(() => makeStatusOptions(t), [t]);

  const columns = useMemo(
    () =>
      buildUserColumns(t, {
        onEdit: setEditing,
        onDeactivate: setDeactivating,
        onActivate: (u) => activate.mutate(u.id),
        currentUserId: currentUser?.id ?? 0,
      }),
    // `activate` is a stable mutation object from TanStack Query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.id, t]
  );

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <div className="users-page">
      <div className="page-title-row">
        <div>
          <h1>{t('list.title')}</h1>
          {isLoading ? (
            <span className="sk" style={{ width: 110, height: 14, display: 'inline-block', marginTop: 2 }} />
          ) : (
            <p className="page-subtitle">
              {/* The design's subtitle counts ALL internal users, not the
                  filtered page — the facets endpoint supplies it so the
                  number does not jump when a filter is applied. */}
              {facets
                ? t('list.subtitleWithDepartments', {
                    count: facets.total,
                    departments: facets.department_total,
                  })
                : t('list.subtitle', { count: total })}
            </p>
          )}
        </div>
        <div className="page-title-actions">
          <Link to="/users/audit-log" className="dt-btn dt-btn-outline fv">
            {t('list.auditLog')}
          </Link>
          <Link to="/users/settings" className="dt-btn dt-btn-outline fv">
            {t('list.settings')}
          </Link>
          <button type="button" className="dt-btn dt-btn-primary fv" onClick={() => setInviteOpen(true)}>
            {t('list.inviteUser')}
          </button>
        </div>
      </div>

      <div className="toolbar-row">
        {isLoading ? (
          <div className="facet-row">
            <span className="sk" style={{ width: 100, height: 28, borderRadius: 8 }} />
            <span className="sk" style={{ width: 140, height: 28, borderRadius: 8 }} />
            <span className="sk" style={{ width: 120, height: 28, borderRadius: 8 }} />
          </div>
        ) : (
          <div className="facet-row">
            <FilterChip
              label={t('list.filterRole')}
              mode="multi"
              options={(facets?.roles ?? []).map((r) => ({ value: r.value, label: r.label, count: r.count }))}
              selected={params.role}
              onChange={(role) => setParams({ role: role as UserRole[] })}
            />
            <FilterChip
              label={t('list.filterDepartment')}
              mode="multi"
              options={(facets?.departments ?? []).map((d) => ({
                value: d.value,
                label: d.value,
                count: d.count,
              }))}
              selected={params.department}
              onChange={(department) => setParams({ department })}
            />
            <FilterChip
              label={t('list.filterStatus')}
              mode="single"
              options={statusOptions}
              selected={[params.status]}
              onChange={([status]) => setParams({ status: status as UserStatusFilter })}
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
                {
                  label: t('list.resetFilters'),
                  variant: 'outline',
                  onClick: () => setParams({ q: '', role: [], department: [], status: 'active' }),
                },
                { label: t('list.inviteUser'), variant: 'primary', onClick: () => setInviteOpen(true) },
              ]}
            />
          ) : (
            <DataTableEmpty
              title={t('list.emptyTitle')}
              body={t('list.emptyBody')}
              actions={[{ label: t('list.inviteUser'), variant: 'primary', onClick: () => setInviteOpen(true) }]}
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
              onRowActivate={setEditing}
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

      <UserFormModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <UserFormModal
        open={editing !== null}
        user={editing ?? undefined}
        onClose={() => setEditing(null)}
      />

      <DeactivateUserDialog
        open={deactivating !== null}
        user={deactivating}
        onClose={() => setDeactivating(null)}
      />
    </div>
  );
};
