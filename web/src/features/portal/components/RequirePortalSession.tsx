import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { usePortalSession } from '../hooks/usePortalSession';

/** Story 17 (WIS-16). The portal's RequireAuth analogue: no token -> back to /portal. */
export const RequirePortalSession: React.FC = () => {
  const { hasToken } = usePortalSession();

  if (!hasToken) {
    return <Navigate to="/portal" replace />;
  }

  return <Outlet />;
};
