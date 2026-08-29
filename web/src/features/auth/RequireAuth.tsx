import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type User } from './AuthContext';
import { useT } from '../../i18n';

interface RequireAuthProps {
  children: React.ReactNode;
  roles?: User['role'][];
}

// The roles prop is a UX affordance, not a security boundary.
// Every protected resource is enforced server-side. Hiding a nav item or route is not access control.
export const RequireAuth: React.FC<RequireAuthProps> = ({ children, roles }) => {
  const { user, status } = useAuth();
  const location = useLocation();
  const { t } = useT('auth');

  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <>
        <style>{`
          .access-denied {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px;
            text-align: center;
            background-color: var(--bg-page, #F8FAFC);
            color: var(--text-main, #0F172A);
            font-family: Inter, system-ui, sans-serif;
            box-sizing: border-box;
          }
          @media (prefers-color-scheme: dark) {
            .access-denied {
              --bg-page: #121317;
              --text-main: #F1F5F9;
              --text-muted: #94A3B8;
            }
          }
          .access-denied h2 {
            font-size: 20px;
            font-weight: 700;
            margin: 0 0 8px 0;
          }
          .access-denied p {
            font-size: 14px;
            color: var(--text-muted, #64748B);
            margin: 0;
          }
        `}</style>
        <div className="access-denied">
          <h2>{t('accessDenied.title')}</h2>
          <p>{t('accessDenied.body', { role: user.role_label })}</p>
        </div>
      </>
    );
  }

  return <>{children}</>;
};
