type Props = {
  /** Drives which of the two distinct empty cases renders. */
  activeCount: number;
  /** Human names of the facets currently narrowing the queue. */
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
          <h2 className="tq-empty-title">No tickets match your filters</h2>
          <p className="tq-empty-body">
            {activeLabels.length > 0
              ? `Try removing ${activeLabels.join(' or ')} to see more results.`
              : 'Try removing a filter to see more results.'}
          </p>
          <button type="button" className="tq-btn-primary" onClick={onClearFilters}>
            Clear filters
          </button>
        </>
      ) : (
        <>
          <h2 className="tq-empty-title">No tickets yet</h2>
          <p className="tq-empty-body">Tickets you or your team create will appear here.</p>
          <button type="button" className="tq-btn-primary" onClick={onNewTicket}>
            New ticket
          </button>
        </>
      )}
    </div>
  );
}
