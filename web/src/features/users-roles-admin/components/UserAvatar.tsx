import React from 'react';

// The 28px initials circle from the USER cell. The tint is derived from the
// user id so a given person keeps the same colour across pages — the design
// shows several different tints, and a random one per render would flicker.
const TINTS = ['indigo', 'blue', 'pink', 'amber', 'green', 'slate'] as const;

export const UserAvatar: React.FC<{ initials: string; id: number }> = ({ initials, id }) => (
  <span className={`user-avatar user-avatar-${TINTS[id % TINTS.length]}`} aria-hidden="true">
    {initials}
  </span>
);
