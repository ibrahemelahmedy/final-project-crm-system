import type { Ticket } from '../../model/ticket';
import { useT } from '../../../../i18n';

/**
 * The relabelled TAGS block (Product rules). Two real chips — the ticket's
 * category and channel labels. No tags table, no free-text tagging.
 */
export function ClassificationCard({ ticket }: { ticket: Ticket }) {
  const { t } = useT('conversation');
  return (
    <section>
      <p className="meta-section-label">{t('section.classification')}</p>
      <div className="classification-chips">
        <span className="classification-chip">{ticket.category_label}</span>
        <span className="classification-chip">{ticket.channel_label}</span>
      </div>
    </section>
  );
}
