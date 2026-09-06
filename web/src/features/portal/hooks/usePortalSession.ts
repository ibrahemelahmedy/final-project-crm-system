import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPortalToken, setPortalToken, setPortalUnauthorizedHandler } from '../api/portalClient';
import { portalLogout } from '../api/portalApi';
import { portalKeys } from '../model/portalKeys';

/** Story 17 (WIS-16). Session-token presence, with the 401 -> clear-and-redirect wiring. */
export function usePortalSession() {
  const [hasToken, setHasToken] = useState<boolean>(() => getPortalToken() !== null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setPortalUnauthorizedHandler(() => {
      setHasToken(false);
      queryClient.removeQueries({ queryKey: portalKeys.all });
    });
    return () => setPortalUnauthorizedHandler(null);
  }, [queryClient]);

  const signIn = useCallback((token: string) => {
    setPortalToken(token);
    setHasToken(true);
  }, []);

  const signOut = useCallback(() => {
    portalLogout().catch(() => {});
    setPortalToken(null);
    setHasToken(false);
    queryClient.removeQueries({ queryKey: portalKeys.all });
  }, [queryClient]);

  return { hasToken, signIn, signOut };
}
