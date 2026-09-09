// Story 24 (WIS-23). The TypeScript mirror of PortalChatConversationResource /
// PortalChatMessageResource and the chat endpoint payloads.

export type ChatReplyState = 'ok' | 'refused' | 'unavailable' | 'ended' | 'rate_limited';

export type ChatCitation = { id: number; slug: string; title: string };

export type PortalChatMessage = {
  id: number;
  role: 'customer' | 'assistant';
  body: string;
  citations: ChatCitation[];
  created_at: string;
};

export type PortalChatConversation = {
  id: number;
  state: 'active' | 'ended' | 'escalated';
  message_count: number;
  messages_remaining: number;
  tokens_remaining: number;
  escalated_ticket_id: number | null;
  created_at: string;
};

export type PortalChatView = {
  enabled: boolean;
  conversation: PortalChatConversation | null;
  messages: PortalChatMessage[];
};

export type PortalChatReply = {
  state: ChatReplyState;
  conversation: PortalChatConversation;
  message: PortalChatMessage | null;
};

export type PortalChatEscalation = {
  conversation: PortalChatConversation;
  ticket: { id: number };
};
