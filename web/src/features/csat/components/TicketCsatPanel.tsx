import { useState } from 'react';
import type { TicketStatus } from '../../tickets';
import { useTicketCsat } from '../hooks/useTicketCsat';
import { RatingGroup } from './RatingGroup';
import { CSAT_STRINGS } from '../model/csatStrings';

const t = CSAT_STRINGS.en; // agent UI is English-only (matches the rest of the app shell)

/**
 * Story 13 — the agent-facing CSAT panel on the ticket-detail side panel.
 *
 * - outstanding survey -> a copy-link button
 * - answered survey    -> read-only rating + comment (comment `dir="auto"` so
 *   an Arabic comment reads correctly inside the English UI)
 * - expired survey     -> a "link expired" line
 *
 * All four async states ship: loading skeleton, error + retry, empty ("no
 * survey yet"), and the populated success states above. This component does
 * NOT restructure the ticket-detail screen — it only renders inside the slot
 * Story 05's panel exposes.
 */
export function TicketCsatPanel({
  ticketId,
  ticketStatus,
}: {
  ticketId: number;
  ticketStatus: TicketStatus;
}) {
  const everResolved = ticketStatus === 'resolved' || ticketStatus === 'closed';
  const { data, isLoading, isError, refetch } = useTicketCsat(ticketId, everResolved);
  const [copied, setCopied] = useState(false);

  if (!everResolved) return null;

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="csat-panel" aria-label="Customer satisfaction survey">
      <p className="meta-section-label">CSAT SURVEY</p>

      {isLoading && <div className="csat-panel-skeleton" aria-busy="true" />}

      {isError && !isLoading && (
        <div className="csat-panel-error">
          <span>Couldn't load the survey.</span>
          <button type="button" className="tq-btn-outline fv" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && data && data.state === 'none' && (
        <p className="csat-panel-empty">No survey for this resolution cycle yet.</p>
      )}

      {!isLoading && !isError && data && data.state === 'outstanding' && (
        <div className="csat-panel-outstanding">
          <p className="csat-panel-hint">
            Share this feedback link with the customer. It expires 30 days after resolution.
          </p>
          <div className="csat-panel-link-row">
            <input className="csat-panel-link" readOnly value={data.share_url} aria-label="Feedback link" />
            <button
              type="button"
              className="tq-btn-outline fv"
              onClick={() => copy(data.share_url)}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      )}

      {!isLoading && !isError && data && data.state === 'answered' && (
        <div className="csat-panel-answered">
          <RatingGroup value={data.rating} readOnly strings={t} />
          {data.comment ? (
            <p className="csat-panel-comment" dir="auto">
              "{data.comment}"
            </p>
          ) : (
            <p className="csat-panel-comment csat-panel-comment-muted">No comment left.</p>
          )}
        </div>
      )}

      {!isLoading && !isError && data && data.state === 'expired' && (
        <p className="csat-panel-empty">The feedback link expired with no response.</p>
      )}
    </section>
  );
}
