import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChannelConnectModal } from './ChannelConnectModal';
import { api } from '../../../lib/api';
import type { ChannelConnection } from '../model/channel';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/api')>('../../../lib/api');
  return { ...actual, api: { ...actual.api, put: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

const put = api.put as ReturnType<typeof vi.fn>;

function connection(overrides: Partial<ChannelConnection> = {}): ChannelConnection {
  return {
    channel: 'whatsapp',
    label_key: 'enums.channel.whatsapp',
    provider: 'whatsapp_cloud',
    status: 'connected',
    secret_last_four: '1234',
    config: { phone_number_id: '999' },
    last_inbound_at: null,
    last_outbound_at: null,
    last_error_key: null,
    last_error_at: null,
    ...overrides,
  };
}

function renderModal(conn: ChannelConnection, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChannelConnectModal connection={conn} onClose={onClose} />
    </QueryClientProvider>
  );
}

describe('ChannelConnectModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the stored secret only as masked last-four text, never the plaintext', () => {
    renderModal(connection({ secret_last_four: '1234' }));
    expect(screen.getByText(/•••• 1234/)).toBeInTheDocument();
  });

  it('never puts the plaintext secret in the DOM', () => {
    renderModal(connection({ secret_last_four: '1234' }));
    expect(document.body.textContent).not.toMatch(/sk_live|whsec_|plaintext/i);
    const input = screen.getByLabelText('Secret') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.type).toBe('password');
  });

  it('omits `secret` from the save payload when the field is left empty', async () => {
    put.mockResolvedValue({ data: { data: connection() } });
    renderModal(connection());

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(put).toHaveBeenCalledTimes(1);
    const [, body] = put.mock.calls[0];
    expect(body).not.toHaveProperty('secret');
  });

  it('includes `secret` in the save payload when the admin types a new value', async () => {
    put.mockResolvedValue({ data: { data: connection() } });
    renderModal(connection());

    await userEvent.type(screen.getByLabelText('Secret'), 'a-new-app-secret');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const [, body] = put.mock.calls[0];
    expect(body).toMatchObject({ secret: 'a-new-app-secret' });
  });
});
