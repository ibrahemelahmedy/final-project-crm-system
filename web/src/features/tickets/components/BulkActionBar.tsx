import { useState } from 'react';
import type { Option, TicketStatus } from '../model/ticket';

type Props = {
  count: number;
  agents: Option[];
  statuses: Option[];
  onAssign: (agentId: number | null, agentName: string) => void;
  onChangeStatus: (status: TicketStatus, label: string) => void;
  onClose: () => void;
  onDismiss: () => void;
};

export function BulkActionBar({
  count,
  agents,
  statuses,
  onAssign,
  onChangeStatus,
  onClose,
  onDismiss,
}: Props) {
  const [menu, setMenu] = useState<'assign' | 'status' | null>(null);

  return (
    <div className="tq-bulk" role="region" aria-label="Bulk actions">
      {/* aria-live so a screen-reader user hears the count change. */}
      <span className="tq-bulk-count" aria-live="polite">
        <span dir="ltr" className="tq-ltr">
          {count}
        </span>{' '}
        selected
      </span>

      <div className="tq-bulk-menu-wrap">
        <button
          type="button"
          className="tq-bulk-btn"
          aria-haspopup="menu"
          aria-expanded={menu === 'assign'}
          onClick={() => setMenu((m) => (m === 'assign' ? null : 'assign'))}
        >
          Assign
        </button>
        {menu === 'assign' && (
          <div className="tq-popover" role="menu" aria-label="Assign to">
            <button
              type="button"
              role="menuitem"
              className="tq-popover-option"
              onClick={() => {
                setMenu(null);
                onAssign(null, 'Unassigned');
              }}
            >
              Unassigned
            </button>
            {agents.map((agent) => (
              <button
                key={agent.value}
                type="button"
                role="menuitem"
                className="tq-popover-option"
                onClick={() => {
                  setMenu(null);
                  onAssign(Number(agent.value), agent.label);
                }}
              >
                {agent.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tq-bulk-menu-wrap">
        <button
          type="button"
          className="tq-bulk-btn"
          aria-haspopup="menu"
          aria-expanded={menu === 'status'}
          onClick={() => setMenu((m) => (m === 'status' ? null : 'status'))}
        >
          Change Status
        </button>
        {menu === 'status' && (
          <div className="tq-popover" role="menu" aria-label="Change status to">
            {statuses.map((status) => (
              <button
                key={status.value}
                type="button"
                role="menuitem"
                className="tq-popover-option"
                onClick={() => {
                  setMenu(null);
                  onChangeStatus(status.value as TicketStatus, status.label);
                }}
              >
                {status.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Close is the one-click common case; Change Status is the general
          form. Both funnel through the same bulk endpoint and the same
          per-row authorization. */}
      <button type="button" className="tq-bulk-btn tq-bulk-btn-danger" onClick={onClose}>
        Close
      </button>

      <div className="tq-bulk-spacer" />

      <button type="button" className="tq-bulk-dismiss" onClick={onDismiss} aria-label="Clear selection">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
