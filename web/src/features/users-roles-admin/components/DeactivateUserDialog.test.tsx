import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeactivateUserDialog } from './DeactivateUserDialog';
import * as adminApi from '../api/adminApi';
import type { AdminUser } from '../model/adminUser';

vi.mock('../api/adminApi');

const target: AdminUser = {
  id: 7,
  name: 'Tom Becker',
  email: 'tom.becker@wisal.io',
  role: 'agent',
  role_label: 'Agent',
  home_route: '/dashboard',
  is_active: true,
  department: 'Technical Support',
  initials: 'TB',
  last_login_at: null,
};

function renderDialog(props: Partial<React.ComponentProps<typeof DeactivateUserDialog>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = props.onClose ?? vi.fn();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <DeactivateUserDialog open user={target} onClose={onClose} {...props} />
    </QueryClientProvider>
  );
  return { ...result, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DeactivateUserDialog', () => {
  it('names the specific user in the title, never "this user"', () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: 'Deactivate Tom Becker?' })).toBeInTheDocument();
    expect(screen.queryByText(/this user/i)).not.toBeInTheDocument();
  });

  it('warns that active sessions end immediately', () => {
    renderDialog();

    expect(screen.getByText(/their active sessions end immediately/i)).toBeInTheDocument();
    expect(screen.getByText(/signed out on its next request/i)).toBeInTheDocument();
  });

  it('states that their history stays attributed to them', () => {
    renderDialog();

    expect(screen.getByText(/tickets and audit history stay attributed/i)).toBeInTheDocument();
  });

  it('issues NO request when cancelled', () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(vi.mocked(adminApi.deactivateUser)).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('issues NO request when dismissed with Escape', () => {
    const { onClose } = renderDialog();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(vi.mocked(adminApi.deactivateUser)).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('focuses Cancel, not the destructive button', async () => {
    renderDialog();

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' })));
  });

  it('deactivates the named user on confirm', async () => {
    vi.mocked(adminApi.deactivateUser).mockResolvedValue({ ...target, is_active: false });
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate User' }));

    await waitFor(() => expect(vi.mocked(adminApi.deactivateUser)).toHaveBeenCalledWith(7));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('surfaces the servers reason and stays open when the rule rejects it', async () => {
    const error = Object.assign(new Error('422'), {
      isAxiosError: true,
      response: {
        status: 422,
        data: { errors: { user: ['You cannot deactivate your own account.'] } },
      },
    });
    vi.mocked(adminApi.deactivateUser).mockRejectedValue(error);
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate User' }));

    await screen.findByText('You cannot deactivate your own account.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing when no user is bound', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DeactivateUserDialog open user={null} onClose={() => {}} />
      </QueryClientProvider>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not show one users error over a different users confirmation', async () => {
    const error = Object.assign(new Error('422'), {
      isAxiosError: true,
      response: { status: 422, data: { errors: { user: ['You cannot deactivate your own account.'] } } },
    });
    vi.mocked(adminApi.deactivateUser).mockRejectedValue(error);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <DeactivateUserDialog open user={target} onClose={() => {}} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate User' }));
    await screen.findByText('You cannot deactivate your own account.');

    rerender(
      <QueryClientProvider client={queryClient}>
        <DeactivateUserDialog
          open
          user={{ ...target, id: 8, name: 'Riya Patel' }}
          onClose={() => {}}
        />
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: 'Deactivate Riya Patel?' })).toBeInTheDocument();
    expect(screen.queryByText('You cannot deactivate your own account.')).not.toBeInTheDocument();
  });
});
