// One key for the whole page — parameterised by range only. A range change
// swaps the key, so every widget refetches from the same single query and
// partial staleness is structurally impossible.
export const reportKeys = {
  all: ['reports'] as const,
  summary: (from: string, to: string) => ['reports', 'summary', from, to] as const,
};
