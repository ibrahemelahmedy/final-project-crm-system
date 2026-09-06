import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/AuthContext';
import { fetchOrganizationBranding } from '../../features/organization/api/organizationApi';

/**
 * Story 20 (WIS-20). Reads `GET /api/organization/branding` — every ACTIVE
 * authenticated user, not just Administrators — and applies the stored
 * override on `<html>`, the same node UiPreferencesContext already writes
 * `data-theme` / `dir` / `lang` to. No loading gate: blocking the app on a
 * branding fetch would make a slow settings query look like a broken
 * login. Renders nothing itself — children pass straight through.
 */
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['organization', 'branding', 'public'],
    queryFn: fetchOrganizationBranding,
    enabled: Boolean(user),
    staleTime: Infinity,
  });

  useEffect(() => {
    const root = document.documentElement;

    if (data?.primary_color) {
      root.style.setProperty('--brand-primary', data.primary_color);
    } else {
      root.style.removeProperty('--brand-primary');
    }
  }, [data?.primary_color]);

  return <>{children}</>;
}
