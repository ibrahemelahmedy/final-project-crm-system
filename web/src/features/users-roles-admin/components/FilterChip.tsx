import React, { useEffect, useRef, useState } from 'react';

export type ChipOption = { value: string; label: string; count?: number };

/**
 * The three filter chips from WisalUsers-LightLTR.dc.html — Role, Department,
 * and Status. One component serves both shapes:
 *
 *  - `multi` (Role, Department): a checkbox listbox, several values at once.
 *  - `single` (Status): a radio listbox, exactly one value, never empty.
 *
 * Status is deliberately NOT multi-select: 'all' already expresses "both", so
 * offering active+inactive as a pair would be a second way to say the same
 * thing and a third state for the URL to carry.
 */
export const FilterChip: React.FC<{
  label: string;
  mode: 'multi' | 'single';
  options: ChipOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  emptySummary?: string;
}> = ({ label, mode, options, selected, onChange, emptySummary = 'All' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-away and Escape close the popover. Without this the chip stays open
  // behind the next one the Administrator opens.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const summary =
    selected.length === 0
      ? emptySummary
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`;

  const toggle = (value: string) => {
    if (mode === 'single') {
      onChange([value]);
      setOpen(false);
      return;
    }
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div className="facet-filter" ref={rootRef}>
      <button
        type="button"
        className="facet-chip fv"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="facet-chip-dot" aria-hidden="true" />
        {label}: {summary}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          aria-multiselectable={mode === 'multi' ? 'true' : undefined}
          className="facet-popover"
        >
          {options.length === 0 && <li className="facet-popover-empty">No options</li>}
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={selected.includes(option.value)}>
              <label className="facet-option">
                <input
                  type={mode === 'multi' ? 'checkbox' : 'radio'}
                  name={mode === 'single' ? `chip-${label}` : undefined}
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
                <span>{option.label}</span>
                {option.count !== undefined && <span className="facet-option-count">{option.count}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
