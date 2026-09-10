import React from 'react';
import { useT, formatDateTime } from '../../../i18n';
import type { WidgetMessage } from '../model/widget';

/**
 * Story 26 (WIS-22). The message list. Author-aligned bubbles (never colour
 * alone — each bubble also carries its author label), oldest first, matching
 * `TicketMessage::publicOnly()`'s ordering from the API.
 */
export const WidgetTranscript: React.FC<{ messages: WidgetMessage[] }> = ({ messages }) => {
  const { t } = useT('chat-widget');

  const authorLabel = (author: WidgetMessage['author_type']) => {
    if (author === 'customer') return t('transcript.you');
    if (author === 'agent') return t('transcript.agent');
    return t('transcript.system');
  };

  if (messages.length === 0) {
    return (
      <div className="widget-transcript widget-transcript-empty">
        <p className="widget-transcript-empty-title">{t('empty.title')}</p>
        <p className="widget-transcript-empty-body">{t('empty.body')}</p>
      </div>
    );
  }

  return (
    <ul className="widget-transcript" aria-label={t('transcript.ariaLabel')}>
      {messages.map((message) => (
        <li
          key={message.id}
          className={`widget-transcript-message widget-transcript-message-${message.author_type}`}
        >
          <span className="widget-transcript-message-author">{authorLabel(message.author_type)}</span>
          <p className="widget-transcript-message-body">{message.body}</p>
          <span className="widget-transcript-message-time">{formatDateTime(message.created_at)}</span>
        </li>
      ))}
    </ul>
  );
};
