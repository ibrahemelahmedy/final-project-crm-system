import React from 'react';
import { Link } from 'react-router-dom';
import { useT, formatDate } from '../../../i18n';
import { useCustomerTickets } from '../hooks/useCustomerTickets';

// The profile's read-only interaction-history panel. Derived LIVE from the
// tickets table via a column-guarded endpoint — never a denormalized copy.
export const InteractionHistory: React.FC<{ customerId: number }> = ({ customerId }) => {
  const { t } = useT('customers');
  const { data, isLoading, isError, refetch } = useCustomerTickets(customerId);

  if (isLoading) {
    return (
      <section className="profile-panel" aria-label={t('interaction.heading')}>
        <h2>{t('interaction.heading')}</h2>
        <div className="dt-empty-body">{t('interaction.loading')}</div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="profile-panel" aria-label={t('interaction.heading')}>
        <h2>{t('interaction.heading')}</h2>
        <p className="dt-empty-body">{t('interaction.error')}</p>
        <button type="button" className="dt-btn dt-btn-outline fv" onClick={() => refetch()}>
          {t('interaction.tryAgain')}
        </button>
      </section>
    );
  }

  // The endpoint is column-guarded until Story 04 (WIS-2) adds
  // tickets.customer_id. Rendering the generic empty state here would
  // falsely assert the customer has raised no tickets.
  if (data?.meta.pending_story === 'WIS-2') {
    return (
      <section className="profile-panel" aria-label={t('interaction.heading')}>
        <h2>{t('interaction.heading')}</h2>
        <p className="dt-empty-body">{t('interaction.pendingStory')}</p>
      </section>
    );
  }

  const tickets = data?.data ?? [];

  return (
    <section className="profile-panel" aria-label={t('interaction.heading')}>
      <h2>{t('interaction.heading')}</h2>
      {tickets.length === 0 ? (
        <p className="dt-empty-body">{t('interaction.empty')}</p>
      ) : (
        <ul className="interaction-list">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="interaction-row">
              {/* Story 04 owns /tickets/:id; it falls through to the "*"
                  redirect until that story lands. Render the link anyway —
                  do not disable it. */}
              <Link to={`/tickets/${ticket.id}`} className="interaction-subject">
                {ticket.subject}
              </Link>
              <span className="interaction-meta">
                {ticket.status} · {ticket.priority} ·{' '}
                <span dir="ltr">{formatDate(ticket.created_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
