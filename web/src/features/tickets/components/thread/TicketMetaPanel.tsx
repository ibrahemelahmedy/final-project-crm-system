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
import { useT } from '../../../../i18n';
import {
  PRIORITY_FALLBACK_LABELS,
  STATUS_FALLBACK_LABELS,
} from '../../model/display';
import type { TicketPriority, TicketStatus } from '../../model/ticket';

type Which = 'status' | 'priority' | null;

const ALL_STATUS_VALUES: TicketStatus[] = ['open', 'pending', 'resolved', 'closed'];
const ALL_PRIORITY_VALUES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export function TicketMetaPanel({
  ticket,
  meta,
  events,
  topSlot,
  extraSlot,
}: {
  ticket: Ticket;
  meta: TicketMeta | undefined;
  events: TicketEvent[];
  /** Story 19 (WIS-18) mounts the AI summary card here — ABOVE "Ticket details", per the design. */
  topSlot?: ReactNode;
  /** Story 13 mounts the CSAT panel here without restructuring this screen. */
  extraSlot?: ReactNode;
}) {
  const { t } = useT('conversation');
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
    const values = allowed ? [ticket.status, ...allowed] : ALL_STATUS_VALUES;
    const labelOf = (v: string) =>
      meta?.statuses?.find((s) => s.value === v)?.label ??
      (STATUS_FALLBACK_LABELS[v as TicketStatus]
        ? t(STATUS_FALLBACK_LABELS[v as TicketStatus])
        : v);
    return values.map((v) => ({ value: v, label: labelOf(v) }));
  })();

  const priorityOptions: Option[] =
    (meta?.priorities?.length ? meta.priorities : null) ??
    ALL_PRIORITY_VALUES.map((v) => ({ value: v, label: t(PRIORITY_FALLBACK_LABELS[v]) }));

  const applyStatusChange = (value: string) => {
    mutation.mutate(
      { status: value as typeof ticket.status },
      {
        onSuccess: () => {
          close();
          setPendingClose(false);
          statusBtn.current?.focus();
        },
        onError: (e) => setError(serverMessage(e) ?? t('meta.notAllowed')),
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
        onError: (e) => setError(serverMessage(e) ?? t('meta.notAllowed')),
      }
    );
  };

  return (
    <aside className="meta-panel">
      {topSlot}
      <section>
        <p className="meta-section-label">{t('section.ticketDetails')}</p>
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
                title={t('meta.changeStatus')}
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
                title={t('meta.changePriority')}
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
        <div className="close-warn-overlay" role="alertdialog" aria-label={t('close.confirmLabel')}>
          <div className="close-warn-card">
            <p className="close-warn-title">{t('close.title')}</p>
            <p className="close-warn-body">
              {t('close.openTasksWarning', { count: openTaskCount })}
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
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                className="tq-btn-danger"
                disabled={mutation.isPending}
                onClick={() => applyStatusChange('closed')}
              >
                {t('close.closeTicket')}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
