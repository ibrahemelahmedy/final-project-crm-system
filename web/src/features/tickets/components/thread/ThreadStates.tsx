import { Link } from 'react-router-dom';

export function ThreadSkeleton() {
  return (
    <div className="thread-card" aria-busy="true" aria-label="Loading conversation">
      <div className="thread-topbar">
        <div className="sk" style={{ blockSize: 16, inlineSize: 140 }} />
      </div>
      <div className="thread-split">
        <div className="thread-col">
          <div className="thread-scroll">
            <div className="thread-skeleton">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`sk thread-skeleton-bubble${i % 2 ? ' thread-skeleton-bubble--out' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="meta-panel">
          <div className="sk" style={{ blockSize: 120 }} />
        </div>
      </div>
    </div>
  );
}

export function ThreadEmpty() {
  return (
    <div className="thread-empty">
      <div className="thread-empty-icon" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16v10H8l-4 4z" />
        </svg>
      </div>
      <h2 className="thread-empty-title">No messages yet</h2>
      <p className="thread-empty-body">
        This ticket was created without a message. Send the first reply to start the thread.
      </p>
    </div>
  );
}

export function ThreadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="thread-empty" role="alert">
      <h2 className="thread-empty-title">This conversation could not be loaded</h2>
      <p className="thread-empty-body">Something went wrong while loading this ticket.</p>
      <button type="button" className="tq-btn-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function ThreadForbidden({ id, role }: { id: number; role?: string }) {
  const body =
    role === 'agent'
      ? `Ticket #${id} is assigned to another agent. Ask a Team Lead to reassign it, or open your own queue.`
      : 'You do not have permission to view this ticket.';
  return (
    <div className="thread-empty" role="alert">
      <h2 className="thread-empty-title">You do not have access to this ticket</h2>
      <p className="thread-empty-body">{body}</p>
      <Link to="/tickets" className="tq-btn-primary">
        Back to Tickets
      </Link>
    </div>
  );
}
