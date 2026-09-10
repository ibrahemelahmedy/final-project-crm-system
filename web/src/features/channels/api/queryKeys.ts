// One key for the Channels overview, parameterised by period only. Switching
// period swaps the key, so returning to a previously viewed period is a cache
// hit rather than a refetch.
//
// Story 26 (WIS-22) adds `connections` (the admin list) and `connection` (one
// channel). Every connect/save/test/disconnect mutation invalidates
// `channelKeys.all`, so the overview's status pill and the connect panel can
// never disagree with each other.
export const channelKeys = {
  all: ['channels'] as const,
  overview: (period: string) => ['channels', 'overview', period] as const,
  connections: () => ['channels', 'connections'] as const,
  connection: (channel: string) => ['channels', 'connections', channel] as const,
};
