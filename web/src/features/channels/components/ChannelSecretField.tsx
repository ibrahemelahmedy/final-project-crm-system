import { useState } from 'react';
import { useT } from '../../../i18n';

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** `secret_last_four`, or null when nothing is stored yet, or when this
   *  field (e.g. verify_token) has no masked echo at all. */
  lastFour: string | null;
  error?: string;
};

/**
 * Story 26 (WIS-22), Task 66. Same behaviour as
 * integrations/components/SecretField.tsx: the stored secret is shown ONLY
 * as `•••• 1234` built from `lastFour`, an empty input means "keep the
 * stored value" (the three-state contract SaveChannelConnectionRequest
 * expects — absent key on submit), and the plaintext already on the server
 * is never read back into this field.
 */
export function ChannelSecretField({ id, label, value, onChange, lastFour, error }: Props) {
  const { t } = useT('channels');
  const [revealed, setRevealed] = useState(false);
  const empty = value === '';

  return (
    <div className="ch-field">
      <label className="ch-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="ch-secret-row">
        <input
          id={id}
          type={revealed ? 'text' : 'password'}
          className="ch-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
        <button
          type="button"
          className="dt-btn dt-btn-outline ch-secret-btn"
          disabled={empty}
          onClick={() => setRevealed((r) => !r)}
        >
          {revealed ? t('connect.hide') : t('connect.reveal')}
        </button>
      </div>
      {lastFour && empty && <p className="ch-field-hint">{t('connect.savedHint', { last4: lastFour })}</p>}
      {error && <p className="ch-field-error">{error}</p>}
    </div>
  );
}
