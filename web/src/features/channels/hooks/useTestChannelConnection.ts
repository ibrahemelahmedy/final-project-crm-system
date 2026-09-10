import { useMutation, useQueryClient } from '@tanstack/react-query';
import { channelKeys } from '../api/queryKeys';
import { testChannelConnection } from '../api/channelsApi';

/**
 * Unlike Integrations' useTestIntegration, a channel test is NOT read-only —
 * ChannelConnectionController@test persists the outcome onto the row
 * (`status` and `last_error_key` both change server-side), so this
 * invalidates `channelKeys.all` too.
 */
export function useTestChannelConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: string) => testChannelConnection(channel),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}
