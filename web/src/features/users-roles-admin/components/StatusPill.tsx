import React from 'react';

// Port of the STATUS cell. brief.md's accessibility rule: the pill needs a
// LABEL, not just a colour — the dot is decorative and the word Active /
// Inactive is always rendered beside it.
export const StatusPill: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <span className={`status-pill ${isActive ? 'status-pill-active' : 'status-pill-inactive'}`}>
    <span className="status-pill-dot" aria-hidden="true" />
    {isActive ? 'Active' : 'Inactive'}
  </span>
);
