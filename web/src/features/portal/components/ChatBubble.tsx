import React from 'react';
import { useT, formatDateTime } from '../../../i18n';
import type { PortalChatMessage } from '../model/portalChat';
import { ChatCitations } from './ChatCitations';

/**
 * Story 24 (WIS-23). One chat turn. Reuses portal.css's message bubble classes
 * rather than inventing new ones.
 */
export const ChatBubble: React.FC<{ message: PortalChatMessage }> = ({ message }) => {
  const { t } = useT('portal');
  const isCustomer = message.role === 'customer';

  return (
    <div className={`portal-message ${isCustomer ? 'portal-message-customer' : 'portal-message-agent'}`}>
      <div style={{ fontSize: '12px', fontWeight: 600, marginBlockEnd: '4px', opacity: 0.85 }}>
        {isCustomer ? t('chat.you') : t('chat.assistant')}
      </div>
      <div dir="auto" style={{ whiteSpace: 'pre-wrap' }}>
        {message.body}
      </div>
      {!isCustomer && <ChatCitations citations={message.citations} />}
      <div style={{ fontSize: '11px', opacity: 0.7, marginBlockStart: '4px' }}>
        {formatDateTime(message.created_at)}
      </div>
    </div>
  );
};
