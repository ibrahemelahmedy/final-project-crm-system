import { api } from '../../../lib/api';
import type { SlaRule } from '../model/types';
import type { SlaRuleInput } from '../model/slaRuleSchema';

// The shared Axios instance from web/src/lib/api.ts. Do not create a second
// client. SlaRuleResource::collection() returns Laravel's { data: [...] }
// envelope; it is unwrapped here so no component knows about it.

export const fetchSlaRules = async (): Promise<SlaRule[]> =>
  (await api.get<{ data: SlaRule[] }>('/sla-rules')).data.data;

export const createSlaRule = async (body: SlaRuleInput): Promise<SlaRule> =>
  (await api.post<{ data: SlaRule }>('/sla-rules', body)).data.data;

export const updateSlaRule = async (id: number, body: Partial<SlaRuleInput>): Promise<SlaRule> =>
  (await api.patch<{ data: SlaRule }>(`/sla-rules/${id}`, body)).data.data;
