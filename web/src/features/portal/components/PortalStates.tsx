import React from 'react';
import { useT } from '../../../i18n';

/**
 * Story 17 (WIS-16). The four async states are mandatory on every portal
 * screen (docs/design/brief.md lines 181-187). The five undesigned screens
 * (Decision 3) have no artboard to copy, so loading / empty / error are
 * built once here and reused, which is also what keeps them consistent.
 */

/** Skeleton — a shape-of-the-content placeholder, not a spinner. */
export const PortalSkeleton: React.FC<{ rows?: number; label?: string }> = ({ rows = 3, label }) => {
  const { t } = useT('portal');

  return (
    <div className="portal-skeleton-stack" role="status" aria-live="polite" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="portal-skeleton-row" aria-hidden="true">
          <span className="portal-skeleton" style={{ width: '60%', height: '14px' }} />
          <span className="portal-skeleton" style={{ width: '35%', height: '12px' }} />
        </div>
      ))}
      <span className="portal-visually-hidden">{label ?? t('ui.loading')}</span>
    </div>
  );
};

/** Empty — explains the state AND offers the next action (brief.md line 185). */
export const PortalEmpty: React.FC<{
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode;
}> = ({ message, actionLabel, onAction, action }) => (
  <div className="portal-empty">
    <p>{message}</p>
    {action ??
      (actionLabel && onAction ? (
        <button type="button" className="portal-link" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null)}
  </div>
);

/** Error — always retryable, never a dead end. */
export const PortalError: React.FC<{ message?: string; onRetry?: () => void }> = ({ message, onRetry }) => {
  const { t } = useT('portal');

  return (
    <div className="portal-error" role="alert">
      <p>{message ?? t('ui.error')}</p>
      {onRetry && (
        <button type="button" className="portal-link" onClick={onRetry}>
          {t('ui.retry')}
        </button>
      )}
    </div>
  );
};
