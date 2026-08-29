/**
 * Query keys namespaced `['dashboard', <role>, <widget>]` so Story 11
 * (notifications) and Story 12 (reports) can invalidate a single widget
 * precisely rather than the whole dashboard.
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  agent: {
    summary: ['dashboard', 'agent', 'summary'] as const,
    queue: ['dashboard', 'agent', 'queue'] as const,
    slaRisk: ['dashboard', 'agent', 'sla-risk'] as const,
    quickReplies: ['dashboard', 'agent', 'quick-replies'] as const,
  },
  team: {
    summary: ['dashboard', 'team', 'summary'] as const,
    workload: ['dashboard', 'team', 'workload'] as const,
    escalations: ['dashboard', 'team', 'escalations'] as const,
  },
  admin: {
    summary: ['dashboard', 'admin', 'summary'] as const,
  },
} as const;
