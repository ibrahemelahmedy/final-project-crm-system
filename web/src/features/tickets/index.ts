// The ONLY public surface of this feature. App.tsx imports from here, never
// from a file inside it.
export { TicketQueuePage } from './pages/TicketQueuePage';
export { TicketDetailPage } from './pages/TicketDetailPage';
// Shared by the Agent Dashboard (Story 07) so SLA-risk and priority keep a
// single visual definition (brief.md line 217; Story 04 owns the tokens).
export { PriorityBadge } from './components/PriorityBadge';
export { SlaCell } from './components/SlaCell';
export type { Ticket, TicketSla, SlaRisk, TicketPriority, TicketStatus } from './model/ticket';
// Story 19 (WIS-18): the ai-assist feature nests its query key under
// ticketKeys.all so every ticket mutation already invalidates it — the
// index's cross-cutting rule that ticketKeys is the ONE keying scheme.
export { ticketKeys } from './api/queryKeys';
