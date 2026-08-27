import React, { useState } from 'react';

export type FacetOption = { value: string; label: string; count: number };

// Port of WisalCustomers-LightLTR.dc.html lines 66-69 (the chip) opening a
// checkbox listbox popover.
export const FacetFilter: React.FC<{
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}> = ({ label, options, selected, onChange }) => {
  const [open, setOpen] = useState(false);

  const summary =
    selected.length === 0
      ? 'All'
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div className="facet-filter">
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
        <ul role="listbox" aria-label={label} className="facet-popover" aria-multiselectable="true">
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={selected.includes(option.value)}>
              <label className="facet-option">
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
                <span>{option.label}</span>
                <span className="facet-option-count">{option.count}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
