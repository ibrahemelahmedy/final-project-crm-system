import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../../i18n';
import { DataTable } from '../../../components/data-table/DataTable';
import { DataTableSkeleton } from '../../../components/data-table/DataTableSkeleton';
import { DataTableEmpty } from '../../../components/data-table/DataTableEmpty';
import { DataTableError } from '../../../components/data-table/DataTableError';
import type { ColumnDef } from '../../../components/data-table/types';
import { useBranches } from '../hooks/useBranches';
import { useDepartments } from '../hooks/useDepartments';
import { useSaveDepartment } from '../hooks/useSaveDepartment';
import { DepartmentModal } from './DepartmentModal';
import { RowActions } from './RowActions';
import { StatusPill } from './StatusPill';
import type { Department } from '../model/types';

const noop = () => {};

/**
 * DepartmentsTab — docs/design/references/20.WisalOrgSettings-Departments/.
 * Grid `1.4fr 1.2fr 0.8fr 0.9fr 90px`. Needs BOTH branches and departments —
 * the branches list decides whether the no-branch-yet banner and the
 * disabled Add-department path render, per the second and third artboards.
 */
export function DepartmentsTab() {
  const { t } = useT('organization');
  const { data: branchesData, isLoading: branchesLoading } = useBranches();
  const { data, isLoading, isError, refetch } = useDepartments();
  const save = useSaveDepartment();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | undefined>(undefined);

  const branches = branchesData ?? [];
  const hasBranches = branches.length > 0;

  const openAdd = () => {
    setEditing(undefined);
    setModalOpen(true);
  };

  const openEdit = (department: Department) => {
    setEditing(department);
    setModalOpen(true);
  };

  const deactivate = (department: Department) => {
    save.mutate({
      id: department.id,
      body: { branch_id: department.branch_id, name: department.name, is_active: false },
    });
  };

  const columns: ColumnDef<Department>[] = useMemo(
    () => [
      { id: 'name', header: t('departments.column.name'), width: '1.4fr', locked: true, cell: (row) => row.name },
      { id: 'branch', header: t('departments.column.branch'), width: '1.2fr', cell: (row) => row.branch_name ?? '—' },
      { id: 'agents', header: t('departments.column.agents'), width: '0.8fr', cell: (row) => row.agent_count },
      { id: 'status', header: t('departments.column.status'), width: '0.9fr', cell: (row) => <StatusPill isActive={row.is_active} /> },
      {
        id: 'actions',
        header: t('departments.column.actions'),
        width: '90px',
        align: 'end',
        cell: (row) => (
          <RowActions
            isActive={row.is_active}
            onEdit={() => openEdit(row)}
            onDeactivate={() => deactivate(row)}
            editLabel={t('actions.edit')}
            deactivateLabel={t('actions.deactivate')}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  const rows = data ?? [];

  return (
    <div className="org-tab-panel">
      {!branchesLoading && !hasBranches && (
        <div className="org-no-branch-banner" role="status">
          <span>{t('departments.noBranchBanner')}</span>
          <Link to="/organization" className="org-no-branch-banner-link">
            {t('departments.goToBranches')}
          </Link>
        </div>
      )}

      <div className="org-tab-toolbar">
        <button type="button" className="dt-btn dt-btn-primary fv" onClick={openAdd}>
          {t('departments.addButton')}
        </button>
      </div>

      <div className="table-card">
        {isLoading ? (
          <DataTableSkeleton columns={columns} />
        ) : isError ? (
          <DataTableError onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <DataTableEmpty
            title={t('departments.empty.title')}
            body={t('departments.empty.body')}
            actions={[{ label: t('departments.addButton'), variant: 'primary', onClick: openAdd }]}
          />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.name}
            selectedIds={[]}
            onSelectionChange={noop}
            sort={null}
            onSortChange={noop}
            caption={t('departments.tableCaption')}
          />
        )}
      </div>

      <DepartmentModal
        open={modalOpen}
        department={editing}
        branches={branches}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
