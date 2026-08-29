import React from 'react';
import type { UserRole } from '../model/adminUser';

// Port of WisalUsers-LightLTR.dc.html's ROLE cell: the label is upper-cased
// (TEAM LEAD / AGENT / ADMINISTRATOR) and each role carries its own tint.
// The visible text is upper-cased through CSS text-transform, NOT by
// upper-casing the string — Story 15 switches the locale and Arabic has no
// case, so a toUpperCase() here would be a no-op the design silently loses.
export const RoleBadge: React.FC<{ role: UserRole; label: string }> = ({ role, label }) => (
  <span className={`role-badge role-badge-${role.replace('_', '-')}`}>{label}</span>
);
