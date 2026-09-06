import { useEffect, useRef } from 'react';
import { useT, formatRelative } from '../../../i18n';
import { useTicketAssist } from '../hooks/useTicketAssist';
import { useGenerateSummary } from '../hooks/useAssistMutations';

const AI_ICON_PATH = 'M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z';
const REGENERATE_ICON_PATH = 'M4 4v5h5 M20 20v-5h-5 M4.5 15a8 8 0 0 0 14 3.4 M19.5 9a8 8 0 0 0-14-3.4';

/**
 * Story 19 (WIS-18) — the ticket-summary card, first child of the metadata
 * panel (above "Ticket details"). Auto-generates once on mount; a failed
 * attempt does NOT retry itself (Decision 3 in the story plan) — the agent
 * presses Retry.
 */
export function AiSummaryCard({ ticketId }: { ticketId: number }) {
  const { t } = useT('conversation');
  const query = useTicketAssist(ticketId);
  const mutation = useGenerateSummary(ticketId);
  const attempted = useRef(false);

  const enabled = query.data?.enabled ?? false;
  const summary = query.data?.summary ?? null;

  useEffect(() => {
    if (!query.isSuccess || !enabled || summary || attempted.current || mutation.isPending) {
      return;
    }
    attempted.current = true;
    mutation.mutate();
    // Only the data that decides WHETHER to fire belongs in the deps; adding
    // `mutation` would refire on every mutation state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, enabled, summary]);

  if (!enabled) return null;
  if (query.isPending) return null; // no empty card flicker before the first read resolves

  if (summary) {
    return (
      <div className="assist-card assist-card--summary">
        <div className="assist-card-header">
          <div className="assist-chip-group">
            <span className="assist-chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d={AI_ICON_PATH} />
              </svg>
              AI
            </span>
            <span className="assist-label">{t('assist.summaryLabel')}</span>
          </div>
          <button
            type="button"
            className="assist-icon-btn fv"
            aria-label={t('assist.regenerateSummary')}
            title={t('assist.regenerateSummary')}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={REGENERATE_ICON_PATH} />
            </svg>
          </button>
        </div>
        <div className="assist-body">{summary.content}</div>
        {summary.updated_at && (
          <p className="assist-meta">{t('assist.summarizedAgo', { time: formatRelative(summary.updated_at) })}</p>
        )}
      </div>
    );
  }

  if (mutation.isError) {
    return (
      <div className="assist-failed" role="status">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
        <span>{t('assist.summaryFailed')}</span>
        <button type="button" className="assist-retry-btn" onClick={() => mutation.mutate()}>
          {t('common:actions.retry')}
        </button>
      </div>
    );
  }

  // No summary yet and no error yet: either the mount effect is about to
  // fire, or the generate request is in flight. Same skeleton either way.
  return (
    <div className="assist-card assist-card--summary" aria-busy="true" aria-label={t('assist.generating')}>
      <div className="assist-skeleton-row">
        <div className="sk" style={{ blockSize: 16, inlineSize: 70, borderRadius: 5 }} />
        <div className="sk" style={{ blockSize: 20, inlineSize: 20, borderRadius: 5 }} />
      </div>
      <div className="sk" style={{ blockSize: 10, inlineSize: '100%', borderRadius: 4 }} />
      <div className="sk" style={{ blockSize: 10, inlineSize: '92%', borderRadius: 4 }} />
      <div className="sk" style={{ blockSize: 10, inlineSize: '60%', borderRadius: 4 }} />
    </div>
  );
}
