import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { widgetClient } from '../api/widgetClient';
import { setWidgetSessionToken } from '../api/widgetSession';
import type {
  IdentifyResponse,
  MessagesResponse,
  SendMessageResponse,
  StartSessionResponse,
  WidgetMessage,
  WidgetState,
} from '../model/widget';

function stateAllowsPolling(state: WidgetState): boolean {
  return state === 'awaiting_identity' || state === 'active';
}

/**
 * Story 26 (WIS-22), Decisions 10 & 11.
 *
 * Owns the whole widget conversation lifecycle: `POST /widget/chat/sessions`
 * (bootstrap), the `GET /widget/chat/messages?after=<id>` poll loop on
 * `config('channels.chat.poll_seconds')` (default 5, echoed back by the
 * start response), the `after` read cursor, and `identify` / `sendMessage`.
 *
 * The session token is NOT React state — it lives in the module-scoped
 * variable in `../api/widgetSession` (never `localStorage`, mirroring
 * `web/src/lib/api.ts`'s staff-token decision; here it additionally stops
 * one visitor's chat leaking into the next visitor's on a shared device)
 * and is attached to every `widgetClient` request by that module's own
 * interceptor.
 *
 * Polling STOPS the instant `state` becomes 'ended'. The API itself never
 * returns 'ended' — Edge Case 26 has `ChatWidgetAuth` answer a plain 401 when
 * the session died, and this hook is what turns that 401 into the 'ended'
 * state and tears the poll loop down.
 */
export function useWidgetChat(siteKey: string | null) {
  const [state, setState] = useState<WidgetState>('loading');
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pollSecondsRef = useRef(5);
  const afterRef = useRef(0);
  const [after, setAfter] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleUnauthorized = useCallback((err: unknown): boolean => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      setState('ended');
      setWidgetSessionToken(null);
      return true;
    }
    return false;
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await widgetClient.get<MessagesResponse>('/widget/chat/messages', {
        params: afterRef.current > 0 ? { after: afterRef.current } : undefined,
      });

      if (!mountedRef.current) return;

      if (res.data.messages.length > 0) {
        const lastId = res.data.messages[res.data.messages.length - 1].id;
        afterRef.current = lastId;
        setAfter(lastId);
        setMessages((prev) => [...prev, ...res.data.messages]);
      }

      setState(res.data.state === 'open' ? 'active' : 'awaiting_identity');
    } catch (err) {
      if (!mountedRef.current) return;
      // A transient network hiccup does not end the session; only a 401
      // (handled here) does — the next scheduled poll otherwise tries again.
      handleUnauthorized(err);
    }
  }, [handleUnauthorized]);

  const start = useCallback(async () => {
    if (!siteKey) {
      setState('error');
      setError('missing_key');
      return;
    }

    setState('loading');
    setError(null);

    try {
      const res = await widgetClient.post<StartSessionResponse>('/widget/chat/sessions', {
        site_key: siteKey,
      });

      if (!mountedRef.current) return;

      setWidgetSessionToken(res.data.token);
      pollSecondsRef.current = res.data.poll_seconds || 5;
      afterRef.current = 0;
      setAfter(0);
      setMessages([]);
      setState(res.data.state === 'open' ? 'active' : 'awaiting_identity');
    } catch {
      if (!mountedRef.current) return;
      setState('error');
      setError('start_failed');
    }
  }, [siteKey]);

  // Bootstrap on mount, and again whenever the site key changes (a
  // navigation inside the same iframe document — not expected in practice,
  // but the hook stays correct rather than assuming it).
  useEffect(() => {
    mountedRef.current = true;
    void start();

    return () => {
      mountedRef.current = false;
      stopPolling();
      setWidgetSessionToken(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  // The poll loop itself: schedules the NEXT poll only after the current one
  // settles (never overlapping requests), and only while `state` allows it.
  useEffect(() => {
    if (!stateAllowsPolling(state)) {
      stopPolling();
      return stopPolling;
    }

    let cancelled = false;

    const tick = () => {
      void poll().finally(() => {
        if (!cancelled && mountedRef.current) {
          timerRef.current = setTimeout(tick, pollSecondsRef.current * 1000);
        }
      });
    };

    timerRef.current = setTimeout(tick, pollSecondsRef.current * 1000);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [state, poll, stopPolling]);

  const identify = useCallback(
    async (name: string, email: string) => {
      try {
        const res = await widgetClient.post<IdentifyResponse>('/widget/chat/identify', { name, email });
        if (!mountedRef.current) return;
        afterRef.current = 0;
        setAfter(0);
        setMessages([]);
        setState(res.data.state === 'open' ? 'active' : 'awaiting_identity');
        await poll();
      } catch (err) {
        if (!mountedRef.current || !handleUnauthorized(err)) throw err;
      }
    },
    [poll, handleUnauthorized]
  );

  const sendMessage = useCallback(
    async (body: string) => {
      try {
        const res = await widgetClient.post<SendMessageResponse>('/widget/chat/messages', { body });
        if (!mountedRef.current) return;
        setState(res.data.state === 'open' ? 'active' : 'awaiting_identity');
        await poll();
      } catch (err) {
        if (!mountedRef.current || !handleUnauthorized(err)) throw err;
      }
    },
    [poll, handleUnauthorized]
  );

  return {
    state,
    messages,
    error,
    identify,
    sendMessage,
    retry: start,
    /** The current read cursor — exposed for tests. */
    after,
  };
}
