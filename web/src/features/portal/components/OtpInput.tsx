import React, { useRef } from 'react';
import { useT } from '../../../i18n';

const LENGTH = 6;

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  errorId?: string;
};

/**
 * Story 17 (WIS-16). Six real <input> elements, per
 * docs/design/references/16.WisalPortalAccess-Step2/…-LightLTR.dc.html
 * lines 44-49 — not styled <div>s. Always dir="ltr": a numeric code is not
 * mirrored even inside an RTL page.
 */
export const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, disabled, invalid, errorId }) => {
  const { t } = useT('portal');
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.split('').concat(Array(LENGTH).fill('')).slice(0, LENGTH);

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(''));
  };

  const handleChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');

    if (raw.length > 1) {
      // A paste landed in one box — fill all six from it.
      const next = raw.slice(0, LENGTH).split('');
      onChange(next.join('').padEnd(LENGTH, ''));
      const lastIndex = Math.min(next.length, LENGTH) - 1;
      refs.current[lastIndex >= 0 ? lastIndex : 0]?.focus();
      return;
    }

    setDigit(index, raw);
    if (raw && index < LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  // maxLength={1} means a browser truncates a pasted string before it ever
  // reaches onChange, so paste-to-fill has to be caught here. handleChange
  // keeps its own multi-character branch for programmatic value changes.
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pasted.length <= 1) return;

    e.preventDefault();
    const next = pasted.slice(0, LENGTH);
    onChange(next);
    refs.current[Math.min(next.length, LENGTH) - 1]?.focus();
  };

  const handleKeyDown = (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="portal-otp-row" dir="ltr">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          className="portal-otp-digit fv"
          value={digit}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          aria-label={t('access.digitLabel', { n: index + 1 })}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
};
