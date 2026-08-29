import { useRef, useState, type ReactNode } from 'react';
import type { Ticket, TicketMeta, TicketEvent, Option } from '../../model/ticket';
import { PriorityBadge } from '../PriorityBadge';
import { StatusBadge } from '../StatusBadge';
import { AttributePopover } from './AttributePopover';
import { SlaCard } from './SlaCard';
import { AssignedAgentCard } from './AssignedAgentCard';
import { CustomerInfoCard } from './CustomerInfoCard';
import { ClassificationCard } from './ClassificationCard';
import { ActivityList } from './ActivityList';
import { useTicketAttributeMutation } from '../../hooks/useTicketAttributeMutation';
import { serverMessage } from '../../model/apiError';
import { TicketTasksPanel, useOpenTaskCount } from '../../../agent-productivity';

type Which = 'status' | 'priority' | null;

const ALL_STATUSES: Option[] = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function TicketMetaPanel({
  ticket,
  meta,
  events,
  extraSlot,
}: {
  ticket: Ticket;
  meta: TicketMeta | undefined;
  events: TicketEvent[];
  /** Story 13 mounts the CSAT panel here without restructuring this screen. */
  extraSlot?: ReactNode;
}) {
  const [open, setOpen] = useState<Which>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState(false);
  const statusBtn = useRef<HTMLButtonElement>(null);
  const priorityBtn = useRef<HTMLButtonElement>(null);
  const mutation = useTicketAttributeMutation(ticket.id);
  const openTaskCount = useOpenTaskCount(ticket.id);

  const close = () => {
    setOpen(null);
    setError(null);
  };

  const statusOptions: Option[] = (() => {
    const allowed = meta?.transitions?.[ticket.status];
    const values = allowed
      ? [ticket.status, ...allowed]
      : ALL_STATUSES.map((s) => s.value as typeof ticket.status);
    const labelOf = (v: string) =>
      meta?.statuses?.find((s) => s.value === v)?.label ??
      ALL_STATUSES.find((s) => s.value === v)?.label ??
      v;
    return values.map((v) => ({ value: v, label: labelOf(v) }));
  })();

  const priorityOptions: Option[] = (meta?.priorities?.length ? meta.priorities : null) ?? [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  const applyStatusChange = (value: string) => {
    mutation.mutate(
      { status: value as typeof ticket.status },
      {
        onSuccess: () => {
          close();
          setPendingClose(false);
          statusBtn.current?.focus();
        },
        onError: (e) => setError(serverMessage(e) ?? 'That change was not allowed.'),
      }
    );
  };

  const choose = (which: 'status' | 'priority', value: string) => {
    setError(null);

    // Story 10: "warn, then auto-cancel." Closing with open tasks needs an
    // explicit confirmation naming the count before the PATCH fires.
    if (which === 'status' && value === 'closed' && openTaskCount > 0) {
      setPendingClose(true);
      return;
    }

    if (which === 'status') {
      applyStatusChange(value);
      return;
    }

    mutation.mutate(
      { priority: value },
      {
        onSuccess: () => {
          close();
          priorityBtn.current?.focus();
        },
        onError: (e) => setError(serverMessage(e) ?? 'That change was not allowed.'),
      }
    );
  };

  return (
    <aside className="meta-panel">
      <section>
        <p className="meta-section-label">TICKET DETAILS</p>
        <div className="meta-badges">
          <span className="meta-badge-wrap">
            <button
              type="button"
              ref={statusBtn}
              className="meta-badge-btn"
              onClick={() => setOpen(open === 'status' ? null : 'status')}
              aria-haspopup="dialog"
              aria-expanded={open === 'status'}
            >
              <StatusBadge status={ticket.status} label={ticket.status_label} />
            </button>
            {open === 'status' && (
              <AttributePopover
                title="Change status"
                value={ticket.status}
                options={statusOptions}
                isPending={mutation.isPending}
                error={error}
                onChoose={(v) => choose('status', v)}
                onClose={close}
              />
            )}
          </span>

          <span className="meta-badge-wrap">
            <button
              type="button"
              ref={priorityBtn}
              className="meta-badge-btn"
              onClick={() => setOpen(open === 'priority' ? null : 'priority')}
              aria-haspopup="dialog"
              aria-expanded={open === 'priority'}
            >
              <PriorityBadge priority={ticket.priority} label={ticket.priority_label} />
            </button>
            {open === 'priority' && (
              <AttributePopover
                title="Change priority"
                value={ticket.priority}
                options={priorityOptions}
                isPending={mutation.isPending}
                error={error}
                onChoose={(v) => choose('priority', v)}
                onClose={close}
              />
            )}
          </span>
        </div>
        <SlaCard sla={ticket.sla} />
      </section>

      <AssignedAgentCard ticket={ticket} meta={meta} />
      {ticket.customer && <CustomerInfoCard customer={ticket.customer} />}
      <ClassificationCard ticket={ticket} />
      <TicketTasksPanel ticketId={ticket.id} />
      {extraSlot}
      <ActivityList events={events} />

      {pendingClose && (
        <div className="close-warn-overlay" role="alertdialog" aria-label="Confirm closing ticket">
          <div className="close-warn-card">
            <p className="close-warn-title">Close this ticket?</p>
            <p className="close-warn-body">
              {openTaskCount} open task{openTaskCount === 1 ? '' : 's'} on this ticket will be cancelled.
            </p>
            {error && <p className="attr-popover-error">{error}</p>}
            <div className="close-warn-actions">
              <button
                type="button"
                className="tq-btn-outline"
                onClick={() => {
                  setPendingClose(false);
                  close();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tq-btn-danger"
                disabled={mutation.isPending}
                onClick={() => applyStatusChange('closed')}
              >
                Close ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
