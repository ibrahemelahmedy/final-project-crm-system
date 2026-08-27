import React from 'react';

// Takes `initials` straight from the resource (contract C4) — never
// computed on the frontend, so there is exactly one implementation of the
// rule.
export const CustomerAvatar: React.FC<{ initials: string; size?: number }> = ({ initials, size = 28 }) => (
  <span
    className="customer-avatar"
    style={{ width: size, height: size, fontSize: size * 0.4 }}
    aria-hidden="true"
  >
    {initials}
  </span>
);
