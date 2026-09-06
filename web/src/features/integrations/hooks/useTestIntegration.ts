import { useMutation } from '@tanstack/react-query';
import { testIntegration, type SaveIntegrationBody } from '../api/integrationsApi';
import type { IntegrationTypeValue } from '../model/types';

/** Test-only. Invalidates NOTHING — the test writes nothing server-side. */
export function useTestIntegration() {
  return useMutation({
    mutationFn: ({ type, body }: { type: IntegrationTypeValue; body: Partial<SaveIntegrationBody> }) =>
      testIntegration(type, body),
  });
}
