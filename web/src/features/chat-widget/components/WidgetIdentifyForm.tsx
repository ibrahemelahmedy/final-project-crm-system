import React, { useState } from 'react';
import { useT } from '../../../i18n';

/**
 * Story 26 (WIS-22), Decision 11 / Edge Case 25. Shown while `state ===
 * 'awaiting_identity'` — the visitor has typed but has no ticket yet.
 * Submitting promotes the session to a ticket and replays every held
 * message, so nothing typed before identification is lost.
 */
export const WidgetIdentifyForm: React.FC<{
  submitting: boolean;
  onSubmit: (name: string, email: string) => void;
}> = ({ submitting, onSubmit }) => {
  const { t } = useT('chat-widget');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const nameValid = name.trim().length > 0;
  const emailValid = /\S+@\S+\.\S+/.test(email.trim());
  const canSubmit = nameValid && emailValid && !submitting;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSubmit(name.trim(), email.trim());
  };

  return (
    <form className="widget-identify-form" onSubmit={submit} noValidate>
      <p className="widget-identify-form-heading">{t('identify.heading')}</p>

      <div className="widget-identify-form-field">
        <label htmlFor="widget-identify-name" className="widget-identify-form-label">
          {t('identify.nameLabel')}
        </label>
        <input
          id="widget-identify-name"
          type="text"
          className="widget-identify-form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          autoComplete="name"
        />
      </div>

      <div className="widget-identify-form-field">
        <label htmlFor="widget-identify-email" className="widget-identify-form-label">
          {t('identify.emailLabel')}
        </label>
        <input
          id="widget-identify-email"
          type="email"
          className="widget-identify-form-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          autoComplete="email"
        />
      </div>

      {touched && !(nameValid && emailValid) && (
        <p className="widget-identify-form-error" role="alert">
          {t('identify.error')}
        </p>
      )}

      <button type="submit" className="widget-identify-form-submit" disabled={!canSubmit}>
        {submitting ? t('identify.submitting') : t('identify.submit')}
      </button>
    </form>
  );
};
