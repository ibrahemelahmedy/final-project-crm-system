import React from 'react';
import { useT, formatDateTime } from '../../../i18n';
import type { PortalMessage } from '../model/portal';

const CLASS_BY_TYPE: Record<PortalMessage['author_type'], string> = {
  customer: 'portal-message-customer',
  agent: 'portal-message-agent',
  system: 'portal-message-system',
};

export const MessageBubble: React.FC<{ message: PortalMessage }> = ({ message }) => {
  const { t } = useT('portal');

  const author =
    message.author_type === 'customer'
      ? t('detail.you')
      : message.author_type === 'system'
      ? t('detail.system')
      : message.author_name;

  return (
    <div className={`portal-message ${CLASS_BY_TYPE[message.author_type]}`}>
      {message.author_type !== 'system' && (
        <div style={{ fontSize: '12px', fontWeight: 600, marginBlockEnd: '4px', opacity: 0.85 }}>{author}</div>
      )}
      <div dir="auto" style={{ whiteSpace: 'pre-wrap' }}>
        {message.body}
      </div>
      <div style={{ fontSize: '11px', opacity: 0.7, marginBlockStart: '4px' }}>
        {formatDateTime(message.created_at)}
      </div>
    </div>
  );
};
