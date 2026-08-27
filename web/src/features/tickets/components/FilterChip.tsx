import { useEffect, useId, useRef, useState } from 'react';
import type { Option } from '../model/ticket';

type Props = {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  onClear: () => void;
};

export function FilterChip({ label, options, selected, onChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const active = selected.length > 0;
  const summary = !active
    ? `${label}: All`
    : selected.length === 1
      ? `${label}: ${options.find((o) => o.value === selected[0])?.label ?? selected[0]}`
      : `${label}: ${selected.length} selected`;

  // Closes on Escape and on outside click, returning focus to the chip.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        chipRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || chipRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const toggleValue = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div className="tq-chip-wrap">
      <button
        ref={chipRef}
        type="button"
        className="tq-chip"
        data-active={active ? 'true' : 'false'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {active && <span className="tq-chip-dot" aria-hidden="true" />}
        {summary}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 8l7 7 7-7" />
        </svg>
      </button>

      {active && (
        <button
          type="button"
          className="tq-chip-clear"
          onClick={onClear}
          aria-label={`Clear ${label.toLowerCase()} filter`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {open && (
        <div ref={popoverRef} id={listId} className="tq-popover" role="listbox" aria-multiselectable="true" aria-label={label}>
          {options.length === 0 && <p className="tq-popover-empty">No options</p>}
          {options.map((option) => (
            <label key={option.value} className="tq-popover-option" role="option" aria-selected={selected.includes(option.value)}>
              <input
                type="checkbox"
                className="tq-checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggleValue(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
