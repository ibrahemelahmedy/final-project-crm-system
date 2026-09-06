import React from 'react';
import { NavLink } from 'react-router-dom';
import { useT } from '../../../i18n';

/**
 * Story 17 (WIS-16). In-PAGE navigation between the two signed-in screens.
 * It deliberately does NOT live in PortalLayout's header: Decision 6 and AC8
 * freeze that header at wordmark + language + theme and nothing else.
 * /portal/requests and /portal/history stay separate routes so AC3 and AC4
 * can be tested separately.
 */
export const PortalTabs: React.FC = () => {
  const { t } = useT('portal');

  const className = ({ isActive }: { isActive: boolean }) =>
    `portal-tab fv${isActive ? ' portal-tab-active' : ''}`;

  return (
    <nav className="portal-tabs" aria-label={t('nav.requests')}>
      <NavLink to="/portal/requests" end className={className}>
        {t('nav.requests')}
      </NavLink>
      <NavLink to="/portal/history" end className={className}>
        {t('nav.history')}
      </NavLink>
    </nav>
  );
};
