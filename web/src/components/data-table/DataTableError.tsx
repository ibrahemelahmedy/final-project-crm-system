import React from 'react';
import { useT } from '../../i18n';

// Not in any export — built from the empty state's geometry with the danger
// token. brief.md line 185: "Error (actionable, retryable, no raw stack
// trace)". Never render error.message or a stack.
export const DataTableError: React.FC<{
  message?: string | null;
  onRetry: () => void;
}> = ({ message, onRetry }) => {
  const { t } = useT('common');
  return (
    <div className="dt-empty">
      <div className="dt-empty-icon dt-empty-icon-danger" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4 M12 17h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <h2 className="dt-empty-title">{t('state.errorTitle')}</h2>
      <p className="dt-empty-body">{message || t('table.loadError')}</p>
      <div className="dt-empty-actions">
        <button type="button" className="dt-btn dt-btn-primary fv" onClick={onRetry}>
          {t('table.tryAgain')}
        </button>
      </div>
    </div>
  );
};
