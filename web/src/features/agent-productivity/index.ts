// The ONLY public surface of this feature — per the plan's "Frontend public
// surface" contract. App.tsx, Story 05's composer/meta-panel, and Story 07's
// dashboard import from here and nothing deeper.
export { QuickReplyPicker } from './components/QuickReplyPicker';
export type { QuickReplyPickerProps } from './components/QuickReplyPicker';
export { TicketTasksPanel } from './components/TicketTasksPanel';
export { useMyOpenTasks } from './hooks/useMyOpenTasks';
export { QuickRepliesPage } from './pages/QuickRepliesPage';

// Small extra export beyond the plan's four — see useOpenTaskCount.ts for
// why Story 05's TicketMetaPanel needs it (the close-ticket warning).
export { useOpenTaskCount } from './hooks/useOpenTaskCount';

export type { QuickReply, TicketQuickReply } from './model/quickReply';
export type { TicketTask, TaskStatus, DueState } from './model/task';
