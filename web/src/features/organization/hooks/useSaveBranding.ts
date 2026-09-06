import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationKeys } from '../api/queryKeys';
import { removeBrandingLogo, saveBranding, uploadBrandingLogo } from '../api/organizationApi';

function useInvalidateBranding() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: organizationKeys.branding() });
}

export function useSavePrimaryColor() {
  const invalidate = useInvalidateBranding();

  return useMutation({
    mutationFn: (primaryColor: string | null) => saveBranding(primaryColor),
    onSuccess: () => invalidate(),
  });
}

export function useUploadLogo() {
  const invalidate = useInvalidateBranding();

  return useMutation({
    mutationFn: (file: File) => uploadBrandingLogo(file),
    onSuccess: () => invalidate(),
  });
}

export function useRemoveLogo() {
  const invalidate = useInvalidateBranding();

  return useMutation({
    mutationFn: () => removeBrandingLogo(),
    onSuccess: () => invalidate(),
  });
}
