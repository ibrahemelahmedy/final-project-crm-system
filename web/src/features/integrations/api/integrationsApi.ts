import { api } from '../../../lib/api';
import type {
  ConflictRule,
  Integration,
  IntegrationEventValue,
  IntegrationTypeValue,
  OutboxMessage,
  Paginated,
  SyncRun,
} from '../model/types';

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

// ---- Integration data sync (Story 25, WIS-24) ---------------------------

export type SyncConfigBody = {
  inbound_enabled: boolean;
  inbound_url: string | null;
  inbound_field_map: Record<string, string>;
  conflict_rules: Record<string, ConflictRule>;
  outbound_enabled: boolean;
  outbound_url: string | null;
  outbound_events: IntegrationEventValue[];
};

export const saveSyncConfig = async (type: IntegrationTypeValue, body: SyncConfigBody): Promise<Integration> =>
  (await api.put<{ data: Integration }>(`/admin/integrations/${type}/sync-config`, body)).data.data;

export const fetchSyncRuns = async (type: IntegrationTypeValue, page: number): Promise<Paginated<SyncRun>> =>
  (await api.get<Paginated<SyncRun>>(`/admin/integrations/${type}/sync-runs`, { params: { page } })).data;

export const runSyncNow = async (type: IntegrationTypeValue): Promise<SyncRun> =>
  (await api.post<{ data: SyncRun }>(`/admin/integrations/${type}/sync`)).data.data;

export const fetchDeadLetters = async (type: IntegrationTypeValue, page: number): Promise<Paginated<OutboxMessage>> =>
  (await api.get<Paginated<OutboxMessage>>(`/admin/integrations/${type}/outbox`, { params: { page } })).data;

export const retryDeadLetters = async (type: IntegrationTypeValue): Promise<{ requeued: number }> =>
  (await api.post<{ requeued: number }>(`/admin/integrations/${type}/outbox/retry`)).data;
