import { Link } from 'react-router-dom';
import { useCustomer } from '../../../customers';
import type { TicketParty } from '../../model/ticket';

function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(d);
}

/**
 * Sourced from GET /api/customers/{id} — not TicketResource.customer, which is
 * {id, name} only. Its own three states; a failed fetch never blanks the screen.
 */
export function CustomerInfoCard({ customer }: { customer: TicketParty }) {
  const query = useCustomer(customer.id);

  return (
    <section>
      <p className="meta-section-label">CUSTOMER</p>

      {query.isPending ? (
        <div className="meta-card">
          <div className="sk" style={{ blockSize: 12, inlineSize: '60%' }} />
          <div className="sk" style={{ blockSize: 12, inlineSize: '80%', marginBlockStart: 8 }} />
        </div>
      ) : query.isError || !query.data ? (
        <div className="meta-card">
          <Link to={`/customers/${customer.id}`} className="customer-card-name">
            {customer.name}
          </Link>
          <p className="customer-card-line">Contact details unavailable</p>
        </div>
      ) : (
        <div className="meta-card customer-card">
          <div className="customer-card-head">
            <span
              className="thread-avatar thread-avatar--default"
              style={{ inlineSize: 34, blockSize: 34 }}
              aria-hidden="true"
            >
              {query.data.initials}
            </span>
            <div>
              <Link to={`/customers/${customer.id}`} className="customer-card-name">
                {query.data.name}
              </Link>
              <p className="customer-card-since">
                Customer since {monthYear(query.data.created_at)}
              </p>
            </div>
          </div>
          <div className="customer-card-contact">
            {query.data.email && (
              <span className="customer-card-line" dir="ltr">
                {query.data.email}
              </span>
            )}
            {query.data.company && <span className="customer-card-line">{query.data.company}</span>}
            {query.data.phone && (
              <span className="customer-card-line" dir="ltr">
                {query.data.phone}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
