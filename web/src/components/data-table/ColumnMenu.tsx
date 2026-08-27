import { useState } from 'react';
import type { ColumnDef } from './types';

// Buttons, not drag-and-drop — up/down satisfies "reorder" for every input
// method (pointer, keyboard, touch) without a DnD dependency this project
// does not have.
export function ColumnMenu<T>({
  columns,
  hidden,
  onToggleHidden,
  onMove,
}: {
  columns: ColumnDef<T>[];
  hidden: string[];
  onToggleHidden: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
}) {
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const move = (col: ColumnDef<T>, direction: 'up' | 'down') => {
    onMove(col.id, direction);
    setAnnouncement(`Moved ${col.header} ${direction === 'up' ? 'earlier' : 'later'}`);
  };

  return (
    <div className="dt-column-menu">
      <button
        type="button"
        className="dt-btn dt-btn-outline fv"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Columns
      </button>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {open && (
        <div role="menu" className="dt-column-menu-popover">
          {columns.map((col, i) => (
            <div key={col.id} role="menuitem" className="dt-column-menu-row">
              <label>
                <input
                  type="checkbox"
                  checked={!hidden.includes(col.id)}
                  disabled={col.locked}
                  title={col.locked ? 'The customer name is always shown' : undefined}
                  onChange={() => onToggleHidden(col.id)}
                />
                {col.header}
              </label>
              <div className="dt-column-menu-move">
                <button
                  type="button"
                  className="dt-icon-btn fv"
                  aria-label={`Move ${col.header} earlier`}
                  disabled={i === 0}
                  onClick={() => move(col, 'up')}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="dt-icon-btn fv"
                  aria-label={`Move ${col.header} later`}
                  disabled={i === columns.length - 1}
                  onClick={() => move(col, 'down')}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
