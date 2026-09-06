import { useState } from 'react';
import { useT } from '../../../i18n';
import { useTicketAssist } from '../hooks/useTicketAssist';
import { useDismissSuggestion, useGenerateSuggestion } from '../hooks/useAssistMutations';

const AI_ICON_PATH = 'M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z';
const REGENERATE_ICON_PATH = 'M4 4v5h5 M20 20v-5h-5 M4.5 15a8 8 0 0 0 14 3.4 M19.5 9a8 8 0 0 0-14-3.4';

/**
 * Story 19 (WIS-18) — the suggested-reply card, mounted into the empty
 * `.thread-assist-slot` node ReplyComposer.tsx reserved (Story 05). Six
 * states: idle / generating / ready / used / dismissed / failed. `used` is
 * local — "inserted into the composer" has no server record — and is reset
 * whenever a fresh draft is requested.
 */
export function SuggestedReplyCard({
  ticketId,
  onUse,
}: {
  ticketId: number;
  onUse: (text: string) => void;
}) {
  const { t } = useT('conversation');
  const query = useTicketAssist(ticketId);
  const generate = useGenerateSuggestion(ticketId);
  const dismiss = useDismissSuggestion(ticketId);
  const [used, setUsed] = useState(false);

  const enabled = query.data?.enabled ?? false;
  const suggestion = query.data?.suggestion ?? null;

  const requestDraft = () => {
    setUsed(false);
    generate.mutate();
  };

  const handleUse = () => {
    if (!suggestion) return;
    // Splice at the caret; never clears the composer, never sends.
    onUse(suggestion.content);
    setUsed(true);
  };

  if (!enabled) return null;
  if (query.isPending) return null;

  if (generate.isPending) {
    return (
      <div className="assist-card" aria-busy="true" aria-label={t('assist.generating')}>
        <div className="assist-skeleton-row">
          <div className="sk" style={{ blockSize: 16, inlineSize: 130, borderRadius: 5 }} />
          <div className="sk" style={{ blockSize: 20, inlineSize: 20, borderRadius: 5 }} />
        </div>
        <div className="sk" style={{ blockSize: 11, inlineSize: '100%', borderRadius: 4 }} />
        <div className="sk" style={{ blockSize: 11, inlineSize: '80%', borderRadius: 4 }} />
        <div className="assist-skeleton-actions">
          <div className="sk" style={{ blockSize: 28, inlineSize: 110, borderRadius: 8 }} />
          <div className="sk" style={{ blockSize: 28, inlineSize: 70, borderRadius: 8 }} />
        </div>
      </div>
    );
  }

  if (used) {
    return (
      <div className="assist-used" role="status">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 13l4 4L19 7" />
        </svg>
        <span>{t('assist.inserted')}</span>
      </div>
    );
  }

  if (generate.isError) {
    return (
      <div className="assist-failed" role="status">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
        <span>{t('assist.failed')}</span>
        <button type="button" className="assist-retry-btn" onClick={requestDraft}>
          {t('common:actions.retry')}
        </button>
      </div>
    );
  }

  if (suggestion && !suggestion.dismissed) {
    return (
      <div className="assist-card">
        <div className="assist-card-header">
          <span className="assist-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={AI_ICON_PATH} />
            </svg>
            {t('assist.suggestedReplyLabel')}
          </span>
          <button
            type="button"
            className="assist-icon-btn fv"
            aria-label={t('assist.regenerateSuggestion')}
            title={t('assist.regenerateSuggestion')}
            onClick={requestDraft}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={REGENERATE_ICON_PATH} />
            </svg>
          </button>
        </div>
        <div className="assist-body" dir="auto">
          {suggestion.content}
        </div>
        <div className="assist-actions">
          <button type="button" className="assist-use-btn fv" onClick={handleUse}>
            {t('assist.use')}
          </button>
          <button type="button" className="assist-dismiss-btn fv" onClick={() => dismiss.mutate()}>
            {t('assist.dismiss')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" className="assist-idle-btn fv" onClick={requestDraft}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={AI_ICON_PATH} />
      </svg>
      {t('assist.suggest')}
    </button>
  );
}
