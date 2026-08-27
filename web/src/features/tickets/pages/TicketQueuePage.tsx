import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTicketFilters } from '../hooks/useTicketFilters';
import { useTicketsQuery } from '../hooks/useTicketsQuery';
import { useTicketMeta } from '../hooks/useTicketMeta';
import { useRowSelection } from '../hooks/useRowSelection';
import { useBulkTickets } from '../hooks/useTicketMutations';
import { FACET_LABELS } from '../model/display';
import { SORTABLE, type FacetKey } from '../model/ticketFilters';
import type { TicketStatus } from '../model/ticket';
import { TicketTable } from '../components/TicketTable';
import { TicketQueueSkeleton } from '../components/TicketQueueSkeleton';
import { TicketQueueEmpty } from '../components/TicketQueueEmpty';
import { TicketQueueError } from '../components/TicketQueueError';
import { FilterBar } from '../components/FilterBar';
import { BulkActionBar } from '../components/BulkActionBar';
import { BulkConfirmDialog, type BulkSkipReport } from '../components/BulkConfirmDialog';
import { NewTicketModal } from '../components/NewTicketModal';
import { Pagination } from '../components/Pagination';

type SortKey = (typeof SORTABLE)[number];

type PendingBulk = {
  action: string;
  target?: string;
  tone: 'danger' | 'primary';
  payload:
    | { action: 'assign'; assigned_to: number | null }
    | { action: 'status'; status: TicketStatus };
};

export function TicketQueuePage() {
  const { filters, setFilters, clearFilters, activeCount } = useTicketFilters();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useTicketsQuery(filters);
  const { data: meta } = useTicketMeta();
  const { selected, toggle, setAll, clear } = useRowSelection(filters);
  const bulk = useBulkTickets();

  const [pending, setPending] = useState<PendingBulk | null>(null);
  const [report, setReport] = useState<BulkSkipReport>(null);

  // The modal's open state lives in the URL, so it is routable, shareable and
  // back-button-correct — not component state threaded through the layout.
  const modalOpen = searchParams.get('new') === '1';

  const openModal = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('new', '1');
        return next;
      },
      { replace: false }
    );
  }, [setSearchParams]);

  const closeModal = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('new');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  // Memoised so the callbacks and memos below keep a stable dependency — the
  // `?? []` fallback would otherwise be a fresh array on every render.
  const tickets = useMemo(() => query.data?.data ?? [], [query.data]);

  const onSortChange = useCallback(
    (key: SortKey) => {
      const currentKey = filters.sort.startsWith('-') ? filters.sort.slice(1) : filters.sort;
      const currentDesc = filters.sort.startsWith('-');
      const nextSort = currentKey === key && !currentDesc ? `-${key}` : key;
      setFilters({ sort: nextSort });
    },
    [filters.sort, setFilters]
  );

  const onToggleAll = useCallback(() => {
    const ids = tickets.map((t) => t.id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
    setAll(allSelected ? [] : ids);
  }, [tickets, selected, setAll]);

  const activeLabels = useMemo(() => {
    const labels: string[] = [];
    for (const key of ['priority', 'status', 'channel', 'assigned_to', 'category'] as FacetKey[]) {
      if (filters[key].length > 0) labels.push(`"${FACET_LABELS[key]}"`);
    }
    if (filters.q.trim()) labels.push(`"${filters.q.trim()}"`);
    return labels;
  }, [filters]);

  const selectedRefs = useMemo(
    () => tickets.filter((t) => selected.includes(t.id)).map((t) => t.reference),
    [tickets, selected]
  );

  const runBulk = useCallback(async () => {
    if (!pending) return;
    const result = await bulk.mutateAsync({ ids: selected, ...pending.payload });
    // Report the SERVER's numbers. Never silently claim success when rows
    // were skipped.
    setReport({ applied: result.applied.length, skipped: result.skipped.length });
    clear();
  }, [pending, bulk, selected, clear]);

  const dismissConfirm = useCallback(() => {
    setPending(null);
    setReport(null);
  }, []);

  const total = query.data?.meta.total ?? 0;

  return (
    <div className="tq-page">
      <header className="tq-page-head">
        <h1 className="tq-page-title">Tickets</h1>
        {/* "{total} tickets" only — nothing computes an SLA-breach count until
            Story 06, and a hardcoded number would be a lie on the product's
            most-viewed screen. */}
        <p className="tq-page-subtitle">
          <span dir="ltr" className="tq-ltr">
            {total}
          </span>{' '}
          {total === 1 ? 'ticket' : 'tickets'}
        </p>
      </header>

      {selected.length > 0 && (
        <BulkActionBar
          count={selected.length}
          agents={meta?.agents ?? []}
          statuses={meta?.statuses ?? []}
          onAssign={(agentId, agentName) =>
            setPending({
              action: 'Assign',
              target: agentName,
              tone: 'primary',
              payload: { action: 'assign', assigned_to: agentId },
            })
          }
          onChangeStatus={(status, label) =>
            setPending({
              action: `Set ${label} for`,
              tone: 'primary',
              payload: { action: 'status', status },
            })
          }
          onClose={() =>
            setPending({
              action: 'Close',
              tone: 'danger',
              payload: { action: 'status', status: 'closed' },
            })
          }
          onDismiss={clear}
        />
      )}

      <FilterBar
        filters={filters}
        meta={meta}
        activeCount={activeCount}
        onFacetChange={(key, next) => setFilters({ [key]: next } as never)}
        onSearchChange={(q) => setFilters({ q }, { replace: true })}
        onClearAll={clearFilters}
      />

      <div className="tq-card">
        {query.isPending ? (
          <TicketQueueSkeleton />
        ) : query.isError ? (
          <TicketQueueError error={query.error} onRetry={() => query.refetch()} />
        ) : total === 0 ? (
          <TicketQueueEmpty
            activeCount={activeCount}
            activeLabels={activeLabels}
            onClearFilters={clearFilters}
            onNewTicket={openModal}
          />
        ) : (
          <>
            <TicketTable
              tickets={tickets}
              sort={filters.sort}
              onSortChange={onSortChange}
              selected={selected}
              onToggle={toggle}
              onToggleAll={onToggleAll}
              dimmed={query.isPlaceholderData}
            />
            {query.data && query.data.meta.last_page > 1 && (
              <div className="tq-card-foot">
                <Pagination
                  meta={query.data.meta}
                  onPageChange={(page) => setFilters({ page }, { keepPage: true })}
                />
              </div>
            )}
          </>
        )}
      </div>

      {pending && (
        <BulkConfirmDialog
          action={pending.action}
          count={selected.length || report?.applied || 0}
          references={selectedRefs}
          target={pending.target}
          tone={pending.tone}
          isPending={bulk.isPending}
          report={report}
          onConfirm={runBulk}
          onCancel={dismissConfirm}
        />
      )}

      {modalOpen && <NewTicketModal meta={meta} onClose={closeModal} onCreated={closeModal} />}
    </div>
  );
}
