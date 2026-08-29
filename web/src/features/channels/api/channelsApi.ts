import { api } from '../../../lib/api';
import type { ChannelOverview } from '../model/channel';

// Goes through the shared Axios instance in web/src/lib/api.ts. Do not create
// a second client.
export async function fetchChannelOverview(period: string): Promise<ChannelOverview> {
  const { data } = await api.get('/channels/overview', { params: { period } });
  return data;
}
