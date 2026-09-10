import { useMutation, useQueryClient } from '@tanstack/react-query';
import { channelKeys } from '../api/queryKeys';
import { saveChannelConnection, type SaveChannelConnectionBody } from '../api/channelsApi';

/**
 * Saves a connect/reconfigure. Invalidates `channelKeys.all` — not just the
 * connections list — so the /channels overview's status pill picks up the
 * change too (Task 64's rule).
 */
export function useSaveChannelConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channel, body }: { channel: string; body: SaveChannelConnectionBody }) =>
      saveChannelConnection(channel, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}
