import React from 'react';
import { Outlet } from 'react-router-dom';
import { useUiPreferences } from '../../app/providers/UiPreferencesContext';
import { useT } from '../../i18n';
import './portal.css';

/**
 * Story 17 (WIS-16). The Customer Portal's own minimal public header —
 * wordmark, language pill, theme toggle. NOTHING else: no search, no bell,
 * no avatar, no internal navigation, no staff-login link. Ported from
 * docs/design/references/15.WisalPortalAccess-Step1/WisalPortalAccess-Step1-LightLTR.dc.html
 * lines 28-36, reused verbatim across every portal screen (the design
 * brief's structural rule).
 */
export const PortalLayout: React.FC = () => {
  const { resolvedTheme, toggleTheme, direction, locale, setLocaleLocalOnly } = useUiPreferences();
  const { t } = useT('portal');

  const toggleLang = () => setLocaleLocalOnly(locale === 'ar' ? 'en' : 'ar');

  return (
    <div className="portal-root" data-theme={resolvedTheme} dir={direction} lang={locale}>
      <header className="portal-header">
        <span className="portal-wordmark">{t('brand')}</span>
        <div className="portal-header-toggles" dir="ltr">
          <button
            type="button"
            className="portal-toggle fv"
            onClick={toggleLang}
            aria-label={locale === 'en' ? t('common:shell.switchToArabic') : t('common:shell.switchToEnglish')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
            </svg>
            <span>{locale === 'en' ? 'AR' : 'EN'}</span>
          </button>
          <button
            type="button"
            className="portal-toggle portal-toggle-icon fv"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? t('common:shell.switchToLight') : t('common:shell.switchToDark')}
          >
            {resolvedTheme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
              </svg>
            )}
          </button>
        </div>
      </header>
      <main className="portal-main">
        <Outlet />
      </main>
    </div>
  );
};
