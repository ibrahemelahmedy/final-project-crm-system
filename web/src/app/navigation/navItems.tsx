import React from 'react';
import type { User } from '../../features/auth/AuthContext';

export type NavItemDef = {
  /** i18n key for WIS-11; the English label is the fallback until then. */
  labelKey: string;
  label: string;
  to: string;
  icon: React.ReactNode;
  /** Undefined = visible to every role. */
  roles?: User['role'][];
  group: 'main' | 'admin';
};

const icon = (d: string) => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

export const navItems: NavItemDef[] = [
  {
    labelKey: 'nav.dashboard',
    label: 'Dashboard',
    to: '/dashboard',
    group: 'main',
    icon: icon('M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'),
  },
  {
    labelKey: 'nav.tickets',
    label: 'Tickets',
    to: '/tickets',
    group: 'main',
    icon: icon(
      'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z M9 6v12'
    ),
  },
  {
    labelKey: 'nav.customers',
    label: 'Customers',
    to: '/customers',
    group: 'main',
    icon: icon(
      'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3 2.5-5 5-5s5 2 5 5 M17 11a3 3 0 1 0 0-6 M14 20c.3-2.5 2-4.3 4-4.7 M21 20c-.2-1.7-1-3-2.3-3.8'
    ),
  },
  {
    labelKey: 'nav.knowledgeBase',
    label: 'Knowledge Base',
    to: '/knowledge-base',
    group: 'main',
    icon: icon(
      'M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5c-.8 0-1.5-.7-1.5-1.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5c.8 0 1.5-.7 1.5-1.5z'
    ),
  },
  {
    labelKey: 'nav.channels',
    label: 'Channels',
    to: '/channels',
    group: 'main',
    icon: icon('M4 5h16v10H8l-4 4z'),
  },
  {
    labelKey: 'nav.reports',
    label: 'Reports',
    to: '/reports',
    group: 'main',
    icon: icon('M5 20V10 M11 20V4 M17 20v-7'),
  },
  {
    labelKey: 'nav.slaRules',
    label: 'SLA Rules',
    to: '/sla-rules',
    group: 'admin',
    roles: ['administrator'],
    icon: icon(
      'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9.5 12l1.8 1.8L14.5 10'
    ),
  },
  {
    labelKey: 'nav.users',
    label: 'Users',
    to: '/users',
    group: 'admin',
    roles: ['administrator'],
    icon: icon(
      'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 20c.3-3 2.7-5 5.5-5s5.2 2 5.5 5 M18 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M18 10.5v1M18 15.3v1M15.4 12.4l.9.5M19.7 15l.9.5M15.4 15.6l.9-.5M19.7 12l.9-.5'
    ),
  },
];

// Filtering here is a UX affordance, not a security boundary — server-side
// authorization is the real gate (see RequireAuth.tsx), and hiding a nav
// item is not access control.
export function visibleNavItems(role: User['role']): NavItemDef[] {
  return navItems.filter((item) => !item.roles || item.roles.includes(role));
}

// The sidebar shows one "Dashboard" entry, but the three roles have three
// different home routes (UserRole::homeRoute() in the API). Point the
// Dashboard item at the signed-in user's own home so a Team Lead or
// Administrator lands back where they started, and so the item can be
// marked active while they're there.
export function resolveNavItems(items: NavItemDef[], user: User): NavItemDef[] {
  return items.map((item) => (item.to === '/dashboard' ? { ...item, to: user.home_route } : item));
}
