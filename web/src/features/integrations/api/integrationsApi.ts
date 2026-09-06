import { api } from '../../../lib/api';
import type { Integration, IntegrationTypeValue } from '../model/types';

// The shared Axios instance from web/src/lib/api.ts. Do not create a second
// client. Every response is Laravel's `{ data: ... }` envelope; it is
// unwrapped here so no component knows about it.

export const fetchIntegrations = async (): Promise<Integration[]> =>
  (await api.get<{ data: Integration[] }>('/admin/integrations')).data.data;

export type SaveIntegrationBody = { endpoint_url: string; secret?: string };
export type TestResult = { ok: boolean; error_key: string | null };

export const saveIntegration = async (
  type: IntegrationTypeValue,
  body: SaveIntegrationBody,
): Promise<{ integration: Integration; test: TestResult }> => {
  const { data } = await api.put<{ data: Integration; test: TestResult }>(
    `/admin/integrations/${type}`,
    body,
  );

  return { integration: data.data, test: data.test };
};

export const testIntegration = async (
  type: IntegrationTypeValue,
  body: Partial<SaveIntegrationBody>,
): Promise<TestResult> => (await api.post<TestResult>(`/admin/integrations/${type}/test`, body)).data;

export const disconnectIntegration = async (type: IntegrationTypeValue): Promise<void> => {
  await api.delete(`/admin/integrations/${type}`);
};
