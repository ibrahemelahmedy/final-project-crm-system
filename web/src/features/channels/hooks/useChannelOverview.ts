import { useQuery } from '@tanstack/react-query';
import { channelKeys } from '../api/queryKeys';
import { fetchChannelOverview } from '../api/channelsApi';
import type { ChannelPeriod } from '../model/channel';

/** The Channels overview query, keyed on the period so a return visit to a
 *  period already fetched is a cache hit. */
export function useChannelOverview(period: ChannelPeriod) {
  return useQuery({
    queryKey: channelKeys.overview(period),
    queryFn: () => fetchChannelOverview(period),
  });
}
