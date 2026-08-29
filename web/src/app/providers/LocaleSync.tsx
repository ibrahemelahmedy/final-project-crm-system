import { useEffect } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useUiPreferences } from './UiPreferencesContext';
import { isLocale } from '../../i18n';

/**
 * Story 15 (WIS-11), Edge Case "flash of the wrong language on cold load":
 * the local `wisal-lang` copy paints first; the server value from the login
 * response / `GET /api/user` arrives here and reconciles. If they disagree,
 * the server wins — which is what makes "signing in on another machine keeps
 * their language" true. Reconciliation does NOT re-PATCH.
 */
export function LocaleSync() {
  const { user } = useAuth();
  const { syncLocaleFromServer } = useUiPreferences();

  useEffect(() => {
    if (user && isLocale(user.locale)) {
      syncLocaleFromServer(user.locale);
    }
  }, [user, syncLocaleFromServer]);

  return null;
}
