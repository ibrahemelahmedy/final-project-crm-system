import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { useUiPreferences } from '../providers/UiPreferencesContext';
import { NavItem } from '../components/NavItem';
import { HeaderUserSkeleton } from '../components/HeaderUserSkeleton';
import { resolveNavItems, visibleNavItems } from '../navigation/navItems';
import { NotificationBell } from '../../features/notifications';
import { useT } from '../../i18n';

const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme, locale, setLocale } = useUiPreferences();
  const { t } = useT('common');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const closeDrawer = () => {
    setDrawerOpen(false);
    drawerToggleRef.current?.focus();
  };

  // Escape closes the drawer from anywhere on the page while it is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  // Lock body scroll while the drawer is open; always released on unmount,
  // not just on close, or a route change while it's open leaves the page
  // permanently unscrollable.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  // Move focus into the drawer when it opens.
  useEffect(() => {
    if (drawerOpen) {
      sidebarRef.current?.focus();
    }
  }, [drawerOpen]);

  const visible = user ? resolveNavItems(visibleNavItems(user.role), user) : [];
  const mainItems = visible.filter((item) => item.group === 'main');
  const adminItems = visible.filter((item) => item.group === 'admin');

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        {t('shell.skipToContent')}
      </a>

      <div
        className="shell-drawer-backdrop"
        data-open={drawerOpen}
        onClick={closeDrawer}
      />

      <nav
        id="app-sidebar"
        className="shell-sidebar"
        aria-label={t('nav.main')}
        data-open={drawerOpen}
        ref={sidebarRef}
        tabIndex={-1}
      >
        <div className="shell-brand">
          <svg
            viewBox="0 0 64 64"
            width="26"
            height="26"
            aria-hidden="true"
          >
            <circle cx="24" cy="32" r="14" fill="none" stroke="currentColor" strokeWidth="7" />
            <circle cx="42" cy="32" r="9" fill="none" stroke="currentColor" strokeWidth="7" />
          </svg>
          <span className="shell-brand-title">{t('brand')}</span>
        </div>

        <div className="shell-nav-group">
          {mainItems.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={closeDrawer} />
          ))}
        </div>

        {adminItems.length > 0 && (
          <>
            <h2 className="shell-nav-group-label">{t('nav.admin')}</h2>
            <div className="shell-nav-group">
              {adminItems.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={closeDrawer} />
              ))}
            </div>
          </>
        )}

        {user && (
          <div className="shell-sidebar-user">
            <div className="shell-avatar">{initials(user.name)}</div>
            <div>
              <div className="shell-sidebar-user-name">{user.name}</div>
              <div className="shell-sidebar-user-role">{user.role_label}</div>
            </div>
          </div>
        )}
      </nav>

      <div className="shell-column">
        <header className="shell-header">
          <button
            type="button"
            className="shell-drawer-toggle"
            aria-label={t('shell.openNavigation')}
            aria-expanded={drawerOpen}
            aria-controls="app-sidebar"
            onClick={() => setDrawerOpen((open) => !open)}
            ref={drawerToggleRef}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16 M4 12h16 M4 18h16" />
            </svg>
          </button>

          {/* Inert presentational affordance — not a real search field yet. */}
          <div className="shell-search" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3" />
            </svg>
            <span className="shell-search-text">{t('shell.searchPlaceholder')}</span>
            {/* i18n-exempt: keyboard shortcut, must not mirror or translate. */}
            <span className="shell-search-kbd" dir="ltr">⌘K</span>
          </div>

          <div className="shell-header-spacer" />

          {/* The shell must not hold feature state: ?new=1 makes "open the
              create modal" a routable, shareable, back-button-correct fact
              that TicketQueuePage reads. */}
          <Link className="shell-new-ticket-btn" to="/tickets?new=1">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14 M5 12h14" />
            </svg>
            {t('shell.newTicket')}
          </Link>

          <div className="shell-header-divider" />

          <button
            type="button"
            className="shell-icon-btn"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? t('shell.switchToLight') : t('shell.switchToDark')}
          >
            {resolvedTheme === 'dark' ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
              </svg>
            )}
          </button>

          {/* Story 15 (WIS-11) fills Story 02's slot — a two-option toggle, not
              a route change and not a reload, so the route and unsaved form
              state survive by construction. */}
          <button
            type="button"
            className="shell-icon-btn shell-lang-btn"
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            aria-label={locale === 'ar' ? t('shell.switchToEnglish') : t('shell.switchToArabic')}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17 M12 3c2.3 2.5 3.5 5.7 3.5 9s-1.2 6.5-3.5 9c-2.3-2.5-3.5-5.7-3.5-9s1.2-6.5 3.5-9z" />
            </svg>
            {/* i18n-exempt: ISO language pill, shows the language you'd switch TO. */}
            <span className="shell-lang-pill" dir="ltr">{locale === 'ar' ? 'EN' : 'AR'}</span>
          </button>

          <NotificationBell />

          {user ? (
            <button type="button" className="shell-header-user" onClick={() => logout()}>
              <div className="shell-avatar" style={{ width: 32, height: 32 }}>
                {initials(user.name)}
              </div>
              <div className="shell-header-user-info">
                <span className="shell-header-user-name">{user.name}</span>
                <span className="shell-header-user-role">{user.role_label}</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 8l7 7 7-7" />
              </svg>
            </button>
          ) : (
            <HeaderUserSkeleton />
          )}
        </header>

        <main id="main-content" className="shell-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
