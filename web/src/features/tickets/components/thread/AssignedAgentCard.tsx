import { useState } from 'react';
import { Modal } from '../../../../components/ui';
import type { Ticket, TicketMeta } from '../../model/ticket';
import { useTicketAttributeMutation } from '../../hooks/useTicketAttributeMutation';
import { httpStatus, serverMessage } from '../../model/apiError';

export function AssignedAgentCard({
  ticket,
  meta,
}: {
  ticket: Ticket;
  meta: TicketMeta | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string>(
    ticket.assignee ? String(ticket.assignee.id) : ''
  );
  const [error, setError] = useState<string | null>(null);
  const mutation = useTicketAttributeMutation(ticket.id);

  const assignee = ticket.assignee;

  const submit = () => {
    setError(null);
    mutation.mutate(
      { assigned_to: choice === '' ? null : Number(choice) },
      {
        onSuccess: () => setOpen(false),
        onError: (e) => {
          setError(
            httpStatus(e) === 403
              ? 'Only the assigned agent or a Team Lead can reassign this ticket.'
              : (serverMessage(e) ?? 'Could not reassign this ticket.')
          );
        },
      }
    );
  };

  return (
    <section>
      <p className="meta-section-label">ASSIGNED AGENT</p>
      <div className="meta-card agent-card">
        <span className="thread-avatar thread-avatar--agent" style={{ inlineSize: 30, blockSize: 30 }} aria-hidden="true">
          {assignee?.initials ?? '—'}
        </span>
        <span className="agent-card-name">{assignee?.name ?? 'Unassigned'}</span>
        <button type="button" className="link-btn" onClick={() => setOpen(true)}>
          {assignee ? 'Reassign' : 'Assign'}
        </button>
      </div>

      {open && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          titleId="reassign-title"
          title="Reassign ticket"
          width={360}
        >
          <div className="reassign-body">
            <label htmlFor="reassign-select">Assign to</label>
            <select
              id="reassign-select"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">Unassigned</option>
              {(meta?.agents ?? []).map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            {error && (
              <p className="tq-field-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-footer modal-footer-end">
              <button type="button" className="dt-btn dt-btn-outline fv" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="dt-btn dt-btn-primary fv"
                disabled={mutation.isPending}
                onClick={submit}
              >
                {mutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
