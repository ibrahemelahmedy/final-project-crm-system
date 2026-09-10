import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { WidgetChatPage } from './WidgetChatPage';
import { renderWidget } from '../testUtils';
import { widgetClient } from '../api/widgetClient';

vi.mock('../api/widgetClient', () => ({
  widgetClient: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  },
}));

const get = vi.mocked(widgetClient.get);
const post = vi.mocked(widgetClient.post);

const unauthorized = () =>
  new AxiosError('Unauthorized', '401', undefined, null, {
    status: 401,
    statusText: 'Unauthorized',
    data: { message: 'This chat session is no longer valid.' },
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

const startResponse = (state: 'awaiting_identity' | 'open' = 'awaiting_identity') => ({
  data: { token: 'plain-token', expires_at: '2026-09-10T12:00:00Z', poll_seconds: 5, state },
});

const messagesResponse = (messages: unknown[] = [], state: 'awaiting_identity' | 'open' = 'awaiting_identity') => ({
  data: { messages, state },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WidgetChatPage', () => {
  it('renders the loading state while the session is starting', async () => {
    post.mockReturnValue(new Promise(() => {}));
    renderWidget(<WidgetChatPage />);

    expect(screen.getByRole('status', { name: /connecting/i })).toBeInTheDocument();
  });

  it('renders the error state when the session fails to start', async () => {
    post.mockRejectedValueOnce(new Error('forbidden'));
    await act(async () => {
      renderWidget(<WidgetChatPage />);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't start this chat/i);
  });

  it('renders the empty/awaiting-identity state with the identify form', async () => {
    post.mockResolvedValueOnce(startResponse('awaiting_identity'));
    await act(async () => {
      renderWidget(<WidgetChatPage />);
    });

    expect(screen.getByText(/say hello/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start chat/i })).toBeInTheDocument();
  });

  it('transitions from identify to an active ticket and shows replayed messages', async () => {
    vi.useRealTimers();
    post.mockResolvedValueOnce(startResponse('awaiting_identity'));
    renderWidget(<WidgetChatPage />);

    await screen.findByRole('button', { name: /start chat/i });

    post.mockResolvedValueOnce({ data: { state: 'open' } }); // identify
    get.mockResolvedValueOnce(
      messagesResponse(
        [{ id: 1, author_type: 'customer', body: 'hello there', created_at: '2026-09-10T12:00:00Z' }],
        'open'
      )
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/your name/i), 'Dana Ruiz');
    await user.type(screen.getByLabelText(/your email/i), 'dana@example.com');
    await user.click(screen.getByRole('button', { name: /start chat/i }));

    expect(await screen.findByText('hello there')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/widget/chat/identify', {
      name: 'Dana Ruiz',
      email: 'dana@example.com',
    });
  });

  it('advances the `after` cursor across successive polls', async () => {
    post.mockResolvedValueOnce(startResponse('open'));
    get
      .mockResolvedValueOnce(
        messagesResponse([{ id: 5, author_type: 'agent', body: 'first', created_at: '2026-09-10T12:00:00Z' }], 'open')
      )
      .mockResolvedValueOnce(
        messagesResponse([{ id: 9, author_type: 'agent', body: 'second', created_at: '2026-09-10T12:00:05Z' }], 'open')
      );

    await act(async () => {
      renderWidget(<WidgetChatPage />);
    });

    // The first poll fires only after `poll_seconds` (5) elapse — not on mount.
    expect(get).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(get).toHaveBeenNthCalledWith(1, '/widget/chat/messages', { params: undefined });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    expect(screen.getByText('second')).toBeInTheDocument();
    expect(get).toHaveBeenNthCalledWith(2, '/widget/chat/messages', { params: { after: 5 } });
  });

  it('stops polling once the session is reported ended (401)', async () => {
    post.mockResolvedValueOnce(startResponse('open'));
    get.mockRejectedValue(unauthorized());

    await act(async () => {
      renderWidget(<WidgetChatPage />);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });

    expect(screen.getByText(/this chat has ended/i)).toBeInTheDocument();
    const callsAtEnd = get.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(get.mock.calls.length).toBe(callsAtEnd);
  });

  it('does not start a session and shows the error state when ?key= is missing', async () => {
    await act(async () => {
      renderWidget(<WidgetChatPage />, { route: '/widget/chat' });
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't start this chat/i);
    expect(post).not.toHaveBeenCalled();
  });
});
