import { useMemo, useState } from 'react';
import { useT } from '../../../i18n';
import { DataTable } from '../../../components/data-table/DataTable';
import { DataTableSkeleton } from '../../../components/data-table/DataTableSkeleton';
import { DataTableEmpty } from '../../../components/data-table/DataTableEmpty';
import { DataTableError } from '../../../components/data-table/DataTableError';
import type { ColumnDef } from '../../../components/data-table/types';
import { useBranches } from '../hooks/useBranches';
import { useSaveBranch } from '../hooks/useSaveBranch';
import { BranchModal } from './BranchModal';
import { RowActions } from './RowActions';
import { StatusPill } from './StatusPill';
import type { Branch } from '../model/types';

const noop = () => {};

/**
 * BranchesTab — docs/design/references/21.WisalOrgSettings-Branches/.
 * Grid `1.6fr 1fr 0.8fr 0.9fr 90px`. No checkbox column or sort caret in
 * the artboard, so selection and sort are wired as no-ops rather than
 * adding a field to DataTable's frozen ColumnDef surface.
 */
export function BranchesTab() {
  const { t } = useT('organization');
  const { data, isLoading, isError, refetch } = useBranches();
  const save = useSaveBranch();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | undefined>(undefined);

  const openAdd = () => {
    setEditing(undefined);
    setModalOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setModalOpen(true);
  };

  const deactivate = (branch: Branch) => {
    save.mutate({
      id: branch.id,
      body: { name: branch.name, region: branch.region, timezone: branch.timezone, is_active: false },
    });
  };

  const columns: ColumnDef<Branch>[] = useMemo(
    () => [
      { id: 'name', header: t('branches.column.name'), width: '1.6fr', locked: true, cell: (row) => row.name },
      { id: 'region', header: t('branches.column.region'), width: '1fr', cell: (row) => row.region ?? '—' },
      { id: 'agents', header: t('branches.column.agents'), width: '0.8fr', cell: (row) => row.agent_count },
      { id: 'status', header: t('branches.column.status'), width: '0.9fr', cell: (row) => <StatusPill isActive={row.is_active} /> },
      {
        id: 'actions',
        header: t('branches.column.actions'),
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
      <div className="org-tab-toolbar">
        <button type="button" className="dt-btn dt-btn-primary fv" onClick={openAdd}>
          {t('branches.addButton')}
        </button>
      </div>

      <div className="table-card">
        {isLoading ? (
          <DataTableSkeleton columns={columns} />
        ) : isError ? (
          <DataTableError onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <DataTableEmpty
            title={t('branches.empty.title')}
            body={t('branches.empty.body')}
            actions={[{ label: t('branches.addButton'), variant: 'primary', onClick: openAdd }]}
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
            caption={t('branches.tableCaption')}
          />
        )}
      </div>

      <BranchModal open={modalOpen} branch={editing} onClose={() => setModalOpen(false)} />
    </div>
  );
}
