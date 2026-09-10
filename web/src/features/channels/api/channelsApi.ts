import { api } from '../../../lib/api';
import type { ChannelConnection, ChannelOverview } from '../model/channel';

// Goes through the shared Axios instance in web/src/lib/api.ts. Do not create
// a second client.
export async function fetchChannelOverview(period: string): Promise<ChannelOverview> {
  const { data } = await api.get('/channels/overview', { params: { period } });
  return data;
}

// ---- Admin connect/configure/test/disconnect (Story 26, WIS-22) ----------
//
// Four functions over App\Http\Controllers\Admin\ChannelConnectionController.
// Every response is Laravel's `{ data: ... }` envelope where the controller
// returns one, unwrapped here so no component knows about it.

export async function fetchChannelConnections(): Promise<ChannelConnection[]> {
  const { data } = await api.get<{ data: ChannelConnection[] }>('/admin/channels');
  return data.data;
}

// Three-state contract on `secret` / `verify_token` (SaveChannelConnectionRequest):
// absent = keep the stored value, '' = clear it, non-empty = replace it.
export type SaveChannelConnectionBody = {
  provider: string;
  secret?: string;
  verify_token?: string;
  config?: Record<string, unknown>;
};

export async function saveChannelConnection(
  channel: string,
  body: SaveChannelConnectionBody,
): Promise<ChannelConnection> {
  const { data } = await api.put<{ data: ChannelConnection }>(`/admin/channels/${channel}`, body);
  return data.data;
}

export type TestChannelResult = { ok: boolean; checked: boolean; error_key: string | null };

export async function testChannelConnection(channel: string): Promise<TestChannelResult> {
  const { data } = await api.post<TestChannelResult>(`/admin/channels/${channel}/test`);
  return data;
}

export async function disconnectChannel(channel: string): Promise<void> {
  await api.delete(`/admin/channels/${channel}`);
}
