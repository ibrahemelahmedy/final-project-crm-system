import { useState } from 'react';
import { Modal } from '../../../../components/ui';
import { useT } from '../../../../i18n';
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
  const { t } = useT('conversation');
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
              ? t('agent.forbidden')
              : (serverMessage(e) ?? t('agent.error'))
          );
        },
      }
    );
  };

  return (
    <section>
      <p className="meta-section-label">{t('section.assignedAgent')}</p>
      <div className="meta-card agent-card">
        <span className="thread-avatar thread-avatar--agent" style={{ inlineSize: 30, blockSize: 30 }} aria-hidden="true">
          {assignee?.initials ?? '—'}
        </span>
        <span className="agent-card-name">{assignee?.name ?? t('agent.unassigned')}</span>
        <button type="button" className="link-btn" onClick={() => setOpen(true)}>
          {assignee ? t('agent.reassign') : t('agent.assign')}
        </button>
      </div>

      {open && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          titleId="reassign-title"
          title={t('agent.reassignTitle')}
          width={360}
        >
          <div className="reassign-body">
            <label htmlFor="reassign-select">{t('agent.assignTo')}</label>
            <select
              id="reassign-select"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">{t('agent.unassigned')}</option>
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
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                className="dt-btn dt-btn-primary fv"
                disabled={mutation.isPending}
                onClick={submit}
              >
                {mutation.isPending ? t('common:actions.working') : t('common:actions.save')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
