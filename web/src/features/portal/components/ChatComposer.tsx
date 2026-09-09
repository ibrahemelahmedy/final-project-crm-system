import React, { useState } from 'react';
import { useT } from '../../../i18n';

/**
 * Story 24 (WIS-23). Textarea + send. Disabled when the conversation is not
 * active, a send is in flight, or the reply state is ended/rate_limited.
 */
export const ChatComposer: React.FC<{
  disabled: boolean;
  sending: boolean;
  onSend: (body: string) => void;
}> = ({ disabled, sending, onSend }) => {
  const { t } = useT('portal');
  const [value, setValue] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled || sending) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <form className="portal-form" onSubmit={submit} noValidate>
      <div className="portal-field">
        <label htmlFor="portal-chat-input" className="portal-label">
          {t('chat.placeholder')}
        </label>
        <textarea
          id="portal-chat-input"
          className="portal-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          maxLength={1000}
          disabled={disabled || sending}
        />
      </div>
      <button
        type="submit"
        className="portal-btn"
        disabled={disabled || sending || value.trim() === ''}
      >
        {sending ? t('chat.sending') : t('chat.send')}
      </button>
    </form>
  );
};
