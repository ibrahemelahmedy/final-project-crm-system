import React from 'react';

// Reserves the header user slot's exact dimensions so the name arriving
// does not shift the layout. Currently rendered only in the render path a
// unit test can reach directly — Story 01's AuthContext has no 'loading'
// status and makes no bootstrap GET /api/user call, so in the running app
// `user` is set synchronously before AppLayout can render. This becomes
// live the day a refresh-token flow adds a real loading window.
export const HeaderUserSkeleton: React.FC = () => (
  <div className="shell-user-skeleton" aria-hidden="true">
    <div className="shell-skeleton-circle" />
    <div className="shell-skeleton-bars">
      <div className="shell-skeleton-bar shell-skeleton-bar--name" />
      <div className="shell-skeleton-bar shell-skeleton-bar--role" />
    </div>
  </div>
);
