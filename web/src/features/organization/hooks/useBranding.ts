import { useQuery } from '@tanstack/react-query';
import { organizationKeys } from '../api/queryKeys';
import { fetchAdminBranding } from '../api/organizationApi';

/** Admin read — the management surface. See BrandingProvider for the SPA-wide read. */
export function useBranding() {
  return useQuery({
    queryKey: organizationKeys.branding(),
    queryFn: fetchAdminBranding,
  });
}
