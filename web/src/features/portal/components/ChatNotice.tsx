import React from 'react';
import { useT } from '../../../i18n';
import type { ChatReplyState } from '../model/portalChat';

/**
 * Story 24 (WIS-23), Decision 10. One component switching on ChatReplyState,
 * rendering the calm notice plus the "Talk to a person" button.
 */
export const ChatNotice: React.FC<{
  state: ChatReplyState | null;
  escalating: boolean;
  onEscalate: () => void;
}> = ({ state, escalating, onEscalate }) => {
  const { t } = useT('portal');

  if (state === null || state === 'ok') return null;

  const message =
    state === 'ended'
      ? t('chat.ended')
      : state === 'rate_limited'
        ? t('chat.rateLimited')
        : state === 'refused'
          ? null
          : t('chat.unavailable');

  return (
    <div className="portal-hint" role="status">
      {message && <p>{message}</p>}
      <button type="button" className="portal-btn" onClick={onEscalate} disabled={escalating}>
        {escalating ? t('chat.escalating') : t('chat.talkToPerson')}
      </button>
    </div>
  );
};
