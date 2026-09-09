import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  escalatePortalChat,
  fetchPortalChat,
  sendPortalChatMessage,
} from '../api/portalApi';
import { portalKeys } from '../model/portalKeys';
import type { ChatReplyState, PortalChatView } from '../model/portalChat';

/**
 * Story 24 (WIS-23). One query for the live conversation, one mutation to send
 * a message (writing the returned conversation + message into the cache and
 * exposing the returned `state`), and one to escalate. Decision 10's single
 * client-side mapping: HTTP 429 -> state 'rate_limited'.
 */
export function usePortalChat() {
  const queryClient = useQueryClient();
  const [replyState, setReplyState] = useState<ChatReplyState | null>(null);

  const query = useQuery({
    queryKey: portalKeys.chat(),
    queryFn: fetchPortalChat,
  });

  const send = useMutation({
    mutationFn: (body: string) => sendPortalChatMessage(body),
    onSuccess: (reply) => {
      setReplyState(reply.state);
      queryClient.setQueryData<PortalChatView>(portalKeys.chat(), (prev) => ({
        enabled: prev?.enabled ?? true,
        conversation: reply.conversation,
        messages: [
          ...(prev?.messages ?? []),
          ...(reply.message ? [reply.message] : []),
        ],
      }));
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        setReplyState('rate_limited');
      } else {
        setReplyState('unavailable');
      }
    },
  });

  const escalate = useMutation({
    mutationFn: escalatePortalChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.chat() });
      queryClient.invalidateQueries({ queryKey: portalKeys.all });
    },
  });

  return { query, send, escalate, replyState, setReplyState };
}
