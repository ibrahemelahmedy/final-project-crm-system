import { useEffect, useRef, useState } from 'react';
import type { Option } from '../../model/ticket';

type Props = {
  title: string;
  /** current value */
  value: string;
  options: Option[];
  isPending: boolean;
  error: string | null;
  onChoose: (value: string) => void;
  onClose: () => void;
};

export function AttributePopover({
  title,
  value,
  options,
  isPending,
  error,
  onChoose,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
    if (mounted) {
      ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    }
  }, [mounted]);

  return (
    <div className="attr-popover" ref={ref} role="dialog" aria-label={title}>
      <ul className="attr-popover-list" role="listbox" aria-label={title}>
        {options.map((opt) => {
          const isCurrent = opt.value === value;
          return (
            <li key={opt.value} role="option" aria-selected={isCurrent}>
              <button
                type="button"
                className="attr-popover-option"
                disabled={isCurrent || isPending}
                onClick={() => onChoose(opt.value)}
              >
                {opt.label}
                {isCurrent && <span className="tq-sr-only"> (current)</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="attr-popover-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
