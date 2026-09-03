import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../../i18n';

export type BulkSkipReport = { applied: number; skipped: number } | null;

type Props = {
  /** The fully composed, already-translated confirmation question. */
  title: string;
  /** The already-translated label for the confirm button. */
  confirmLabel: string;
  /** Ticket references, e.g. ["#4821", "#4819"]. */
  references: string[];
  tone?: 'danger' | 'primary';
  isPending?: boolean;
  /** Set once the request resolves; the dialog then shows the skip report. */
  report: BulkSkipReport;
  onConfirm: () => void;
  onCancel: () => void;
};

export function BulkConfirmDialog({
  title,
  confirmLabel,
  references,
  tone = 'danger',
  isPending = false,
  report,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useT('tickets');
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
          {title}
        </h2>

        {report ? (
          <p className="tq-confirm-body" role="status">
            {t('bulk.appliedCount', { count: report.applied })}
            {report.skipped > 0 ? ` ${t('bulk.skippedCount', { count: report.skipped })}` : ''}
          </p>
        ) : (
          <p className="tq-confirm-body">
            {rest > 0
              ? t('bulk.andMore', { list: shown.join(', '), count: rest })
              : shown.join(', ')}
          </p>
        )}

        <div className="tq-confirm-actions">
          {report ? (
            <button type="button" className="tq-btn-primary" onClick={onCancel}>
              {t('bulk.done')}
            </button>
          ) : (
            <>
              <button ref={cancelRef} type="button" className="tq-btn-outline" onClick={onCancel}>
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                className={tone === 'danger' ? 'tq-btn-danger' : 'tq-btn-primary'}
                onClick={onConfirm}
                disabled={isPending}
              >
                {isPending ? t('common:actions.working') : confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
