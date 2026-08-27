import { useEffect, useId, useRef, useState } from 'react';
import { useCustomerSearch } from '../../customers';

type Props = {
  /** Must match the <label for> of the field wrapping this control. */
  id: string;
  value: number | undefined;
  onChange: (id: number | undefined, name: string) => void;
  invalid?: boolean;
  describedBy?: string;
};

/**
 * Search-as-you-type over Story 03's customer typeahead, imported through the
 * customers feature barrel — never a deep path.
 *
 * It submits customer_id, NEVER a name string.
 */
export function CustomerCombobox({ id, value, onChange, invalid, describedBy }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  // useCustomerSearch returns Story 03's paginated envelope, not a bare array.
  const { data, isFetching } = useCustomerSearch(text);
  const results = data?.data ?? [];

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const choose = (customer: { id: number; name: string }) => {
    onChange(customer.id, customer.name);
    setText(customer.name);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="tq-combobox" ref={wrapRef}>
      <input
        id={id}
        type="text"
        className="tq-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={text}
        placeholder="Search customers…"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
          // Typing after a pick invalidates it — the form must not keep a
          // customer_id that no longer matches what the user sees.
          if (value !== undefined) onChange(undefined, '');
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open && (
        <ul id={listId} className="tq-combobox-list" role="listbox" aria-label="Customer results">
          {isFetching && <li className="tq-combobox-empty">Searching…</li>}
          {!isFetching && results.length === 0 && text.trim() !== '' && (
            <li className="tq-combobox-empty">No customers found</li>
          )}
          {results.map((customer, index) => (
            <li
              key={customer.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className="tq-combobox-option"
              data-active={index === activeIndex ? 'true' : 'false'}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(customer);
              }}
            >
              <span className="tq-avatar" aria-hidden="true">
                {customer.initials}
              </span>
              <span className="tq-combobox-name">{customer.name}</span>
              {customer.company && <span className="tq-combobox-company">{customer.company}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
