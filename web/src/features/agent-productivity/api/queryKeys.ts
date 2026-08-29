/** One keying scheme for everything this feature owns. */
export const productivityKeys = {
  quickReplies: {
    all: ['quick-replies'] as const,
    list: (params: Record<string, unknown>) => ['quick-replies', 'list', params] as const,
    forTicket: (ticketId: number) => ['quick-replies', 'ticket', ticketId] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    forTicket: (ticketId: number) => ['tasks', 'ticket', ticketId] as const,
    mine: (status: string) => ['tasks', 'mine', status] as const,
  },
  mentionableUsers: (ticketId: number) => ['mentionable-users', ticketId] as const,
};
