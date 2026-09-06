import { useState } from 'react';
import type { TicketStatus } from '../../tickets';
import { useT } from '../../../i18n';
import { useTicketCsat } from '../hooks/useTicketCsat';
import { RatingGroup } from './RatingGroup';

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
  const { t } = useT('csat');
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
    <section className="csat-panel" aria-label={t('panel.ariaLabel')}>
      <p className="meta-section-label">{t('panel.heading')}</p>

      {isLoading && <div className="csat-panel-skeleton" aria-busy="true" />}

      {isError && !isLoading && (
        <div className="csat-panel-error">
          <span>{t('panel.loadError')}</span>
          <button type="button" className="tq-btn-outline fv" onClick={() => refetch()}>
            {t('panel.retry')}
          </button>
        </div>
      )}

      {!isLoading && !isError && data && data.state === 'none' && (
        <p className="csat-panel-empty">{t('panel.empty')}</p>
      )}

      {!isLoading && !isError && data && data.state === 'outstanding' && (
        <div className="csat-panel-outstanding">
          <p className="csat-panel-hint">{t('panel.hint')}</p>
          <div className="csat-panel-link-row">
            <input className="csat-panel-link" readOnly value={data.share_url} aria-label={t('panel.linkLabel')} />
            <button
              type="button"
              className="tq-btn-outline fv"
              onClick={() => copy(data.share_url)}
            >
              {copied ? t('panel.copied') : t('panel.copyLink')}
            </button>
          </div>
        </div>
      )}

      {!isLoading && !isError && data && data.state === 'answered' && (
        <div className="csat-panel-answered">
          <RatingGroup value={data.rating} readOnly t={t} />
          {data.comment ? (
            <p className="csat-panel-comment" dir="auto">
              "{data.comment}"
            </p>
          ) : (
            <p className="csat-panel-comment csat-panel-comment-muted">{t('panel.noComment')}</p>
          )}
        </div>
      )}

      {!isLoading && !isError && data && data.state === 'expired' && (
        <p className="csat-panel-empty">{t('panel.expired')}</p>
      )}
    </section>
  );
}
