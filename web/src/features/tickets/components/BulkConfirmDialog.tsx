import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export type BulkSkipReport = { applied: number; skipped: number } | null;

type Props = {
  /** e.g. "Close" or "Assign" — used verbatim in the title. */
  action: string;
  count: number;
  /** Ticket references, e.g. ["#4821", "#4819"]. */
  references: string[];
  /** Appended to the title, e.g. "to Sarah Ahmed". */
  target?: string;
  tone?: 'danger' | 'primary';
  isPending?: boolean;
  /** Set once the request resolves; the dialog then shows the skip report. */
  report: BulkSkipReport;
  onConfirm: () => void;
  onCancel: () => void;
};

export function BulkConfirmDialog({
  action,
  count,
  references,
  target,
  tone = 'danger',
  isPending = false,
  report,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const invokerRef = useRef<Element | null>(null);

  useEffect(() => {
    invokerRef.current = document.activeElement;
    // Focus lands on Cancel, never the destructive confirm — a destructive
    // default that catches a stray Enter is a footgun.
    cancelRef.current?.focus();

    return () => {
      (invokerRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const shown = references.slice(0, 5);
  const rest = references.length - shown.length;
  const noun = count === 1 ? 'ticket' : 'tickets';

  return createPortal(
    <div className="tq-modal-backdrop">
      <div
        ref={panelRef}
        className="tq-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={`tq-confirm-icon ${tone === 'danger' ? 'tq-confirm-icon-danger' : ''}`} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4 M12 17h.01" />
            <path d="M10.3 3.9L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        </div>

        {/* The title names BOTH the count and the action — brief.md line 186. */}
        <h2 id={titleId} className="tq-confirm-title">
          {action} {count} {noun}
          {target ? ` to ${target}` : ''}?
        </h2>

        {report ? (
          <p className="tq-confirm-body" role="status">
            Applied to {report.applied} {report.applied === 1 ? 'ticket' : 'tickets'}.
            {report.skipped > 0
              ? ` ${report.skipped} skipped — you do not have permission to change them.`
              : ''}
          </p>
        ) : (
          <p className="tq-confirm-body">
            {shown.join(', ')}
            {rest > 0 ? ` and ${rest} more` : ''}
          </p>
        )}

        <div className="tq-confirm-actions">
          {report ? (
            <button type="button" className="tq-btn-primary" onClick={onCancel}>
              Done
            </button>
          ) : (
            <>
              <button ref={cancelRef} type="button" className="tq-btn-outline" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                className={tone === 'danger' ? 'tq-btn-danger' : 'tq-btn-primary'}
                onClick={onConfirm}
                disabled={isPending}
              >
                {isPending ? 'Working…' : action}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
