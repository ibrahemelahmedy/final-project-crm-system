import { useQuery } from '@tanstack/react-query';
import { channelKeys } from '../api/queryKeys';
import { fetchChannelConnections } from '../api/channelsApi';

/** The admin connect-panel query — all connectable channels, connected or
 *  not, in one request. */
export function useChannelConnections() {
  return useQuery({
    queryKey: channelKeys.connections(),
    queryFn: fetchChannelConnections,
  });
}
