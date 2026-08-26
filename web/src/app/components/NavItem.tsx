import React from 'react';
import { NavLink, useMatch, useResolvedPath } from 'react-router-dom';
import type { NavItemDef } from '../navigation/navItems';

export const NavItem: React.FC<{ item: NavItemDef; onNavigate?: () => void }> = ({
  item,
  onNavigate,
}) => {
  // Any of /dashboard, /dashboard/team, /dashboard/admin — the item's `to`
  // is resolved to the signed-in user's own home route by resolveNavItems,
  // so an exact match here is correct rather than a prefix match.
  const isDashboard = item.to.startsWith('/dashboard');
  const resolved = useResolvedPath(item.to);
  // Same isActive flag drives both the visual highlight and aria-current —
  // `end` only on Dashboard, or it stays lit while on /dashboard/admin too.
  const match = useMatch({ path: resolved.pathname, end: isDashboard });
  const isActive = Boolean(match);

  return (
    <NavLink
      to={item.to}
      end={isDashboard}
      onClick={onNavigate}
      className={`nav-item${isActive ? ' nav-item--active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  );
};
