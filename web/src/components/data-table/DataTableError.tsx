import React from 'react';

// Not in any export — built from the empty state's geometry with the danger
// token. brief.md line 185: "Error (actionable, retryable, no raw stack
// trace)". Never render error.message or a stack.
export const DataTableError: React.FC<{
  message?: string | null;
  onRetry: () => void;
}> = ({ message, onRetry }) => (
  <div className="dt-empty">
    <div className="dt-empty-icon dt-empty-icon-danger" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4 M12 17h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    </div>
    <h2 className="dt-empty-title">Something went wrong</h2>
    <p className="dt-empty-body">{message || 'Something went wrong loading customers.'}</p>
    <div className="dt-empty-actions">
      <button type="button" className="dt-btn dt-btn-primary fv" onClick={onRetry}>
        Try again
      </button>
    </div>
  </div>
);
