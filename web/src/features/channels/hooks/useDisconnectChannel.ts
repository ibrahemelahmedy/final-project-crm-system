import { useMutation, useQueryClient } from '@tanstack/react-query';
import { channelKeys } from '../api/queryKeys';
import { disconnectChannel } from '../api/channelsApi';

/** Deletes the channel_connections row outright — the absent row IS the
 *  not-connected state. */
export function useDisconnectChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: string) => disconnectChannel(channel),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}
