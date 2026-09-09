import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { PortalChatPage } from './PortalChatPage';
import * as portalApi from '../api/portalApi';
import { renderPortal, pending } from '../testUtils';
import type {
  PortalChatConversation,
  PortalChatMessage,
  PortalChatReply,
  PortalChatView,
} from '../model/portalChat';

vi.mock('../api/portalApi');

const fetchChat = vi.mocked(portalApi.fetchPortalChat);
const sendMessage = vi.mocked(portalApi.sendPortalChatMessage);

const conversation = (o: Partial<PortalChatConversation> = {}): PortalChatConversation => ({
  id: 1,
  state: 'active',
  message_count: 0,
  messages_remaining: 20,
  tokens_remaining: 12000,
  escalated_ticket_id: null,
  created_at: '2026-09-09T09:00:00Z',
  ...o,
});

const assistantMessage = (o: Partial<PortalChatMessage> = {}): PortalChatMessage => ({
  id: 2,
  role: 'assistant',
  body: 'Use the reset link on the sign-in page.',
  citations: [{ id: 5, slug: 'reset-your-password', title: 'Reset your password' }],
  created_at: '2026-09-09T09:00:05Z',
  ...o,
});

const view = (o: Partial<PortalChatView> = {}): PortalChatView => ({
  enabled: true,
  conversation: null,
  messages: [],
  ...o,
});

const reply = (o: Partial<PortalChatReply> = {}): PortalChatReply => ({
  state: 'ok',
  conversation: conversation({ message_count: 2, messages_remaining: 18 }),
  message: assistantMessage(),
  ...o,
});

const axios429 = () =>
  new AxiosError('Too Many Requests', '429', undefined, null, {
    status: 429,
    statusText: 'Too Many Requests',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

const render = () => renderPortal(<PortalChatPage />, { route: '/portal/chat' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PortalChatPage', () => {
  it('renders the loading skeleton', () => {
    fetchChat.mockReturnValue(pending());
    render();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders an assistant message and its citation link', async () => {
    fetchChat.mockResolvedValue(
      view({
        conversation: conversation({ message_count: 2 }),
        messages: [
          { id: 1, role: 'customer', body: 'reset password', citations: [], created_at: '2026-09-09T09:00:00Z' },
          assistantMessage(),
        ],
      })
    );
    render();

    const link = await screen.findByRole('link', { name: 'Reset your password' });
    expect(link).toHaveAttribute('href', '/portal/faq/reset-your-password');
  });

  it('renders the unavailable notice on state unavailable', async () => {
    fetchChat.mockResolvedValue(view());
    sendMessage.mockResolvedValue(reply({ state: 'unavailable', message: null }));
    render();

    await screen.findByLabelText('Type your question…');
    await userEvent.type(screen.getByLabelText('Type your question…'), 'hello there');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/assistant is unavailable/i)).toBeInTheDocument();
  });

  it('disables the composer on state ended', async () => {
    fetchChat.mockResolvedValue(view());
    sendMessage.mockResolvedValue(reply({ state: 'ended', message: null }));
    render();

    await screen.findByLabelText('Type your question…');
    await userEvent.type(screen.getByLabelText('Type your question…'), 'hello there');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByLabelText('Type your question…')).toBeDisabled());
  });

  it('renders the rate-limited notice when the mutation rejects with 429', async () => {
    fetchChat.mockResolvedValue(view());
    sendMessage.mockRejectedValue(axios429());
    render();

    await screen.findByLabelText('Type your question…');
    await userEvent.type(screen.getByLabelText('Type your question…'), 'hello there');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/too fast/i)).toBeInTheDocument();
  });
});
