import React from 'react';

export type BulkAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  tone?: 'danger';
  disabled?: boolean;
  title?: string;
  onClick: () => void;
};

// Port of WisalCustomers-DarkLTR.dc.html lines 66-74. Renders only when
// count > 0, and occupies the facet row's slot rather than inserting above
// it, so it does not push the table down abruptly.
export const BulkActionBar: React.FC<{
  count: number;
  actions: BulkAction[];
  onClear: () => void;
}> = ({ count, actions, onClear }) => {
  if (count <= 0) return null;

  return (
    <div className="dt-bulk-bar">
      <span className="dt-bulk-count" aria-live="polite">
        {count} selected
      </span>
      <div className="dt-bulk-divider" />
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={action.tone === 'danger' ? 'dt-bulk-action dt-bulk-action-danger fv' : 'dt-bulk-action fv'}
          disabled={action.disabled}
          title={action.title}
          onClick={action.onClick}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
      <div className="dt-bulk-spacer" />
      <button type="button" className="dt-icon-btn fv" aria-label="Clear selection" onClick={onClear}>
        ✕
      </button>
    </div>
  );
};
