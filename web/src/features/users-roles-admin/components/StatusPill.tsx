import React from 'react';
import { useT } from '../../../i18n';

// Port of the STATUS cell. brief.md's accessibility rule: the pill needs a
// LABEL, not just a colour — the dot is decorative and the word Active /
// Inactive is always rendered beside it.
export const StatusPill: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const { t } = useT('users');
  return (
    <span className={`status-pill ${isActive ? 'status-pill-active' : 'status-pill-inactive'}`}>
      <span className="status-pill-dot" aria-hidden="true" />
      {isActive ? t('status.active') : t('status.inactive')}
    </span>
  );
};
