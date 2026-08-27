type Props = {
  error: unknown;
  onRetry: () => void;
};

/**
 * brief.md line 185: "actionable, retryable, no raw stack trace".
 *
 * NEVER renders error.message — an Axios message leaks the API URL. Only the
 * HTTP status is inspected, and every branch is a fixed string.
 */
function statusOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { status?: number } }).response;
    return response?.status;
  }
  return undefined;
}

export function TicketQueueError({ error, onRetry }: Props) {
  const status = statusOf(error);
  const message =
    status === 403
      ? 'You do not have access to this queue.'
      : 'We could not load the ticket queue.';

  return (
    <div className="tq-empty" role="alert">
      <div className="tq-empty-icon tq-empty-icon-danger" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4 M12 17h.01" />
          <path d="M10.3 3.9L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
      </div>
      <h2 className="tq-empty-title">{message}</h2>
      <p className="tq-empty-body">Check your connection and try again.</p>
      <button type="button" className="tq-btn-primary" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
