import React from 'react';
import type { Customer } from '../model/customer';

export const CustomerTierBadge: React.FC<{ tier: Customer['tier']; label: string }> = ({ tier, label }) => (
  <span className={`tier-badge tier-badge-${tier}`}>{label}</span>
);
