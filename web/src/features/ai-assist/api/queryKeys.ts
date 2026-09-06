import { ticketKeys } from '../../tickets';

/** Nests under ticketKeys.all so every ticket mutation already invalidates it. */
export const assistKeys = {
  detail: (id: number) => [...ticketKeys.all, 'ai-assist', id] as const,
};
