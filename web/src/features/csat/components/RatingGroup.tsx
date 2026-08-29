import type { CsatStrings } from '../model/csatStrings';

/**
 * Story 13 — the 1–5 rating control, ported from the design export's
 * `.rating-group`. It is a REAL radio group: five `<input type="radio">` with
 * a shared `name`, visually hidden, their labels styled. That buys native
 * keyboard arrow-key selection and a `:focus-visible` ring on the input for
 * free — no JS key handling, no `outline: none`.
 *
 * Colour is never the only signal: each option carries its number, a text
 * label, and an emoji, and selection is reflected by the radio's `checked`
 * state, not a colour class alone.
 */
export function RatingGroup({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  strings,
}: {
  value: number | null;
  onChange?: (rating: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  strings: CsatStrings;
}) {
  return (
    <div
      className="csat-rating-group"
      role={readOnly ? 'group' : 'radiogroup'}
      aria-label={strings.ratingGroupLabel}
      data-readonly={readOnly || undefined}
    >
      {strings.ratingOptions.map((label, i) => {
        const rating = i + 1;
        const selected = value === rating;
        return (
          <div className="csat-rating-option" key={rating} data-selected={selected || undefined}>
            {!readOnly && (
              <input
                type="radio"
                name="csat-rating"
                id={`csat-r${rating}`}
                value={rating}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange?.(rating)}
              />
            )}
            <label htmlFor={readOnly ? undefined : `csat-r${rating}`} className="csat-rating-label">
              <span className="csat-rating-emoji" aria-hidden="true">
                {strings.ratingEmojis[i]}
              </span>
              {label}
            </label>
          </div>
        );
      })}
    </div>
  );
}
