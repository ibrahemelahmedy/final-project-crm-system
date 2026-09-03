import { useT } from '../../../i18n';

type Props = {
  /** Drives which of the two distinct empty cases renders. */
  activeCount: number;
  /** Translated names of the facets currently narrowing the queue. */
  activeLabels: string[];
  onClearFilters: () => void;
  onNewTicket: () => void;
};

/**
 * TWO distinct empty cases, not one. Shipping the "Clear filters" copy to a
 * user who has set no filters is the version of this state that reads as
 * broken; offering "New ticket" to someone whose filters simply matched
 * nothing hides the way out.
 */
export function TicketQueueEmpty({ activeCount, activeLabels, onClearFilters, onNewTicket }: Props) {
  const { t } = useT('tickets');
  const filtered = activeCount > 0;

  return (
    <div className="tq-empty">
      <div className="tq-empty-icon" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </div>

      {filtered ? (
        <>
          <h2 className="tq-empty-title">{t('queueEmpty.filteredTitle')}</h2>
          <p className="tq-empty-body">
            {activeLabels.length > 0
              ? t('queueEmpty.removeFilters', {
                  filters: activeLabels.join(t('queueEmpty.orSeparator')),
                })
              : t('queueEmpty.removeFilter')}
          </p>
          <button type="button" className="tq-btn-primary" onClick={onClearFilters}>
            {t('queueEmpty.clearFiltersAction')}
          </button>
        </>
      ) : (
        <>
          <h2 className="tq-empty-title">{t('queueEmpty.noTicketsTitle')}</h2>
          <p className="tq-empty-body">{t('queueEmpty.noTicketsBody')}</p>
          <button type="button" className="tq-btn-primary" onClick={onNewTicket}>
            {t('queueEmpty.newTicket')}
          </button>
        </>
      )}
    </div>
  );
}
