import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChannelCard } from './ChannelCard';
import type { ChannelOverviewItem } from '../model/channel';

function item(overrides: Partial<ChannelOverviewItem> = {}): ChannelOverviewItem {
  return {
    value: 'whatsapp',
    label_key: 'channels.whatsapp.label',
    status: 'not_connected',
    ticket_count: 12,
    connection: null,
    ...overrides,
  };
}

describe('ChannelCard', () => {
  it('renders the not_connected label and dot class', () => {
    render(<ChannelCard item={item({ status: 'not_connected' })} count={{ kind: 'count', value: 12 }} />);
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByText('Not connected').closest('.ch-badge')).toHaveClass('ch-badge-not_connected');
  });

  it('renders the connected label and a DIFFERENT dot class', () => {
    render(
      <ChannelCard
        item={item({
          status: 'connected',
          connection: { provider: 'whatsapp_cloud', last_inbound_at: null, inbound_24h: 0, last_error_key: null, connectable: true },
        })}
        count={{ kind: 'count', value: 12 }}
      />
    );
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Connected').closest('.ch-badge')).toHaveClass('ch-badge-connected');
  });

  it('renders the error label and a THIRD distinct dot class', () => {
    render(
      <ChannelCard
        item={item({
          status: 'error',
          connection: {
            provider: 'whatsapp_cloud',
            last_inbound_at: null,
            inbound_24h: 0,
            last_error_key: 'channels.error.no_credential',
            connectable: true,
          },
        })}
        count={{ kind: 'count', value: 12 }}
      />
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Error').closest('.ch-badge')).toHaveClass('ch-badge-error');
  });

  it('the three states use three DIFFERENT classes, never colour alone', () => {
    const classesFor = (status: 'not_connected' | 'connected' | 'error') => {
      const { container, unmount } = render(<ChannelCard item={item({ status })} count={{ kind: 'count', value: 1 }} />);
      const cls = container.querySelector('.ch-badge')?.className ?? '';
      unmount();
      return cls;
    };
    const classes = new Set([classesFor('not_connected'), classesFor('connected'), classesFor('error')]);
    expect(classes.size).toBe(3);
  });

  it('renders the last-inbound line and the 24h count when connection is non-null', () => {
    render(
      <ChannelCard
        item={item({
          status: 'connected',
          connection: {
            provider: 'whatsapp_cloud',
            last_inbound_at: new Date(Date.now() - 60_000).toISOString(),
            inbound_24h: 7,
            last_error_key: null,
            connectable: true,
          },
        })}
        count={{ kind: 'count', value: 12 }}
      />
    );
    expect(screen.getByText(/Last message/i)).toBeInTheDocument();
    expect(screen.getByText(/7 in 24h/i)).toBeInTheDocument();
  });

  it('does not render a last-inbound line when connection is null', () => {
    render(<ChannelCard item={item({ connection: null })} count={{ kind: 'count', value: 12 }} />);
    expect(screen.queryByText(/Last message/i)).not.toBeInTheDocument();
  });

  it('renders last_error_key through t() when status is error', () => {
    render(
      <ChannelCard
        item={item({
          status: 'error',
          connection: {
            provider: 'whatsapp_cloud',
            last_inbound_at: null,
            inbound_24h: 0,
            last_error_key: 'channels.error.no_credential',
            connectable: true,
          },
        })}
        count={{ kind: 'count', value: 12 }}
      />
    );
    expect(screen.getByText('No credential is stored for this channel.')).toBeInTheDocument();
  });
});
