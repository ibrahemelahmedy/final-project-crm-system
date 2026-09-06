import { useState } from 'react';
import { useT } from '../../../i18n';

type Props = {
  value: string;
  onChange: (value: string) => void;
  secretLastFour: string | null;
  error?: string;
};

/**
 * Decision 4 in the story plan. Reveal and Copy act ONLY on the value typed
 * into this input, never on a stored secret — the API never returns one.
 * Both are disabled while the input is empty, so on Configure for an
 * already-connected integration (empty input + secretLastFour set) neither
 * control does anything until the admin types a new value.
 */
export function SecretField({ value, onChange, secretLastFour, error }: Props) {
  const { t } = useT('integrations');
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const empty = value === '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // navigator.clipboard can reject on an insecure origin, or be absent
      // in some test environments — the button simply stays enabled and no
      // "Copied" confirmation appears. No crash, no unhandled rejection.
    }
  };

  return (
    <div className="intg-field">
      <label className="intg-field-label" htmlFor="intg-secret-input">
        {t('form.secret')}
      </label>
      <div className="intg-secret-row">
        <input
          id="intg-secret-input"
          type={revealed ? 'text' : 'password'}
          className="intg-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
        <button
          type="button"
          className="dt-btn dt-btn-outline intg-secret-btn"
          disabled={empty}
          onClick={() => setRevealed((r) => !r)}
        >
          {revealed ? t('form.hide') : t('form.reveal')}
        </button>
        <button type="button" className="dt-btn dt-btn-outline intg-secret-btn" disabled={empty} onClick={copy}>
          {copied ? t('form.copied') : t('form.copy')}
        </button>
      </div>
      {secretLastFour && empty && (
        <p className="intg-field-hint">{t('form.savedHint', { last4: secretLastFour })}</p>
      )}
      {error && <p className="intg-field-error">{error}</p>}
    </div>
  );
}
