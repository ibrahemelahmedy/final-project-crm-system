// Story 26 (WIS-22), Decision 11. TypeScript mirror of
// `ChatWidgetController` (api/app/Http/Controllers/Widget/ChatWidgetController.php)
// — the `chat_sessions` table and its four endpoints. This is a DIFFERENT
// feature from the portal chatbot (Story 24 / WIS-23, `portal_chat_*`); do
// not merge these types with `web/src/features/portal/model/portalChat.ts`.

/** The only two states the API itself ever returns. */
export type ApiChatState = 'awaiting_identity' | 'open';

/**
 * The page's own state machine (the four async states every Wisal screen
 * ships). 'loading' and 'error' never come from the API: 'loading' is the
 * bootstrap `POST /chat/sessions` in flight, 'error' is that call failing
 * (bad or missing `?key=`, a disallowed Origin — Edge Case 24), and 'ended'
 * is synthesised on the client the moment `ChatWidgetAuth` answers 401 —
 * there is no server-side "ended" state (Edge Case 26). The API's 'open' is
 * rendered here as 'active'.
 */
export type WidgetState = 'loading' | 'error' | 'awaiting_identity' | 'active' | 'ended';

export type WidgetMessageAuthor = 'customer' | 'agent' | 'system';

/** Mirrors the `messages[]` entries from `GET /api/widget/chat/messages`. */
export type WidgetMessage = {
  id: number;
  author_type: WidgetMessageAuthor;
  body: string;
  created_at: string;
};

/** `POST /api/widget/chat/sessions` response. */
export type StartSessionResponse = {
  token: string;
  expires_at: string;
  poll_seconds: number;
  state: ApiChatState;
};

/** `GET /api/widget/chat/messages?after=<id>` response. */
export type MessagesResponse = {
  messages: WidgetMessage[];
  state: ApiChatState;
};

/** `POST /api/widget/chat/messages` response — the send endpoint. */
export type SendMessageResponse = {
  state: ApiChatState;
};

/** `POST /api/widget/chat/identify` request body. */
export type IdentifyRequest = {
  name: string;
  email: string;
};

/** `POST /api/widget/chat/identify` response. */
export type IdentifyResponse = {
  state: ApiChatState;
};
