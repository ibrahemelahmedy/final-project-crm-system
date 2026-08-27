import React from 'react';

export type DataTableEmptyAction = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'outline';
};

// Port of WisalCustomers-EmptyState.dc.html lines 78-88.
export const DataTableEmpty: React.FC<{
  title: string;
  body: string;
  actions?: DataTableEmptyAction[];
}> = ({ title, body, actions = [] }) => (
  <div className="dt-empty">
    <div className="dt-empty-icon" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3 2.5-5 5-5s5 2 5 5" />
        <path d="M4 4l16 16" stroke="#DC2626" />
      </svg>
    </div>
    <h2 className="dt-empty-title">{title}</h2>
    <p className="dt-empty-body">{body}</p>
    {actions.length > 0 && (
      <div className="dt-empty-actions">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.variant === 'primary' ? 'dt-btn dt-btn-primary fv' : 'dt-btn dt-btn-outline fv'}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    )}
  </div>
);
