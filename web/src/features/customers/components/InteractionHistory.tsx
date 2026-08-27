import React from 'react';
import { Link } from 'react-router-dom';
import { useCustomerTickets } from '../hooks/useCustomerTickets';

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// The profile's read-only interaction-history panel. Derived LIVE from the
// tickets table via a column-guarded endpoint — never a denormalized copy.
export const InteractionHistory: React.FC<{ customerId: number }> = ({ customerId }) => {
  const { data, isLoading, isError, refetch } = useCustomerTickets(customerId);

  if (isLoading) {
    return (
      <section className="profile-panel" aria-label="Interaction history">
        <h2>Interaction history</h2>
        <div className="dt-empty-body">Loading…</div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="profile-panel" aria-label="Interaction history">
        <h2>Interaction history</h2>
        <p className="dt-empty-body">Something went wrong loading tickets.</p>
        <button type="button" className="dt-btn dt-btn-outline fv" onClick={() => refetch()}>
          Try again
        </button>
      </section>
    );
  }

  // The endpoint is column-guarded until Story 04 (WIS-2) adds
  // tickets.customer_id. Rendering the generic empty state here would
  // falsely assert the customer has raised no tickets.
  if (data?.meta.pending_story === 'WIS-2') {
    return (
      <section className="profile-panel" aria-label="Interaction history">
        <h2>Interaction history</h2>
        <p className="dt-empty-body">Ticket history appears here once Ticket Management ships.</p>
      </section>
    );
  }

  const tickets = data?.data ?? [];

  return (
    <section className="profile-panel" aria-label="Interaction history">
      <h2>Interaction history</h2>
      {tickets.length === 0 ? (
        <p className="dt-empty-body">No tickets yet.</p>
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
                <span dir="ltr">{dateFormatter.format(new Date(ticket.created_at))}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
