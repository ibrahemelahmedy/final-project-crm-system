import { useState } from 'react';
import { useT } from '../../../i18n';
import { splitDuration, toMinutes, type DurationUnit } from '../model/formatDuration';

const MULTIPLIER: Record<DurationUnit, number> = { minutes: 1, hours: 60, days: 1440 };

type Props = {
  id: string;
  label: string;
  help?: string;
  value: number | null;
  onChange: (minutes: number | null) => void;
  error?: string;
  clearable?: boolean;
};

const UNITS: DurationUnit[] = ['minutes', 'hours', 'days'];

/**
 * One number input plus a unit select that together read and write a single
 * MINUTES number.
 *
 * Editing shows the largest whole unit — 240 opens as `4` + `hours` — so the
 * value in the form matches the value on the card, which is the whole point
 * of sharing splitDuration() with formatDuration().
 */
export function DurationField({ id, label, help, value, onChange, error, clearable }: Props) {
  const { t } = useT('sla');

  // The unit is STATE, seeded from the incoming value — not re-derived on
  // every keystroke. Deriving it would mean clearing the number silently
  // resets the unit to minutes, so typing "8" into a field that read
  // "4 hours" would quietly save 8 minutes.
  const [unit, setUnit] = useState<DurationUnit>(
    () => (value === null ? 'minutes' : splitDuration(value).unit),
  );

  const amount = value === null ? '' : String(value / MULTIPLIER[unit]);

  const handleAmount = (raw: string) => {
    if (raw === '') {
      onChange(clearable ? null : 0);
      return;
    }
    onChange(toMinutes(Number(raw), unit));
  };

  const handleUnit = (next: DurationUnit) => {
    setUnit(next);
    // Keep the number the user sees and reinterpret it in the new unit.
    const shown = value === null ? 1 : value / MULTIPLIER[unit];
    onChange(toMinutes(shown || 1, next));
  };

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="slar-duration">
        <input
          id={id}
          type="number"
          min={clearable ? undefined : 1}
          value={amount}
          onChange={(e) => handleAmount(e.target.value)}
          aria-describedby={help ? `${id}-help` : undefined}
          aria-invalid={error ? true : undefined}
        />
        <select
          value={unit}
          aria-label={`${label} — ${t('units.minutes')}`}
          onChange={(e) => handleUnit(e.target.value as DurationUnit)}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {t(`units.${u}`)}
            </option>
          ))}
        </select>
      </div>
      {help && (
        <span id={`${id}-help`} className="form-hint">
          {help}
        </span>
      )}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
