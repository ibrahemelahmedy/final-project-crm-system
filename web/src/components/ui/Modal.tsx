import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// The project's first modal — the pattern every later modal follows:
// - rendered in a portal to document.body
// - role="dialog" aria-modal="true", aria-labelledby -> the title
// - focus moves to the first focusable element on open and RETURNS to the
//   trigger on close
// - focus is trapped inside while open
// - closes on Escape and backdrop click
// - body scroll is locked while open and RELEASED ON UNMOUNT (not just on
//   close) — a modal closed by a route change unmounts without running an
//   onClose path, and a lock set outside a cleanup leaves the page stuck.
//
// The native <dialog> element is deliberately not used — same reasoning as
// Story 02's drawer: its top-layer rendering fights the token palette and
// its default backdrop is not themeable, for no gain this portal doesn't
// already provide.
export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: React.ReactNode;
  width?: number;
}> = ({ open, onClose, titleId, title, children, width = 480 }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirst = () => {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.[0]?.focus();
    };
    focusFirst();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-card"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <button type="button" className="dt-icon-btn fv" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
};
