// One key for the Channels overview, parameterised by period only. Switching
// period swaps the key, so returning to a previously viewed period is a cache
// hit rather than a refetch.
export const channelKeys = {
  all: ['channels'] as const,
  overview: (period: string) => ['channels', 'overview', period] as const,
};
