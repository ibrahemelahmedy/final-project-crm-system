import { Link } from 'react-router-dom';
import { useCustomer } from '../../../customers';
import type { TicketParty } from '../../model/ticket';
import { useT, formatDate } from '../../../../i18n';

const MONTH_YEAR_OPTIONS = { month: 'short' as const, year: 'numeric' as const };

/**
 * Sourced from GET /api/customers/{id} — not TicketResource.customer, which is
 * {id, name} only. Its own three states; a failed fetch never blanks the screen.
 */
export function CustomerInfoCard({ customer }: { customer: TicketParty }) {
  const { t } = useT('conversation');
  const query = useCustomer(customer.id);

  return (
    <section>
      <p className="meta-section-label">{t('section.customer')}</p>

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
          <p className="customer-card-line">{t('customer.detailsUnavailable')}</p>
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
                {t('customer.since', {
                  date: formatDate(query.data.created_at, MONTH_YEAR_OPTIONS),
                })}
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
