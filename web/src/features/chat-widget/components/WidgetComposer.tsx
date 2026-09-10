import React, { useState } from 'react';
import { useT } from '../../../i18n';

const MAX_CHARS = 2000; // channels.chat.max_message_chars default (api/config/channels.php)

/**
 * Story 26 (WIS-22). Textarea + send, usable in BOTH `awaiting_identity`
 * (Edge Case 25 — messages are held on the session) and `active`.
 */
export const WidgetComposer: React.FC<{
  disabled: boolean;
  sending: boolean;
  onSend: (body: string) => void;
}> = ({ disabled, sending, onSend }) => {
  const { t } = useT('chat-widget');
  const [value, setValue] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled || sending) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <form className="widget-composer" onSubmit={submit} noValidate>
      <label htmlFor="widget-composer-input" className="widget-composer-label">
        {t('composer.label')}
      </label>
      <textarea
        id="widget-composer-input"
        className="widget-composer-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('composer.placeholder')}
        rows={2}
        maxLength={MAX_CHARS}
        disabled={disabled || sending}
      />
      <button
        type="submit"
        className="widget-composer-send"
        disabled={disabled || sending || value.trim() === ''}
      >
        {sending ? t('composer.sending') : t('composer.send')}
      </button>
    </form>
  );
};
