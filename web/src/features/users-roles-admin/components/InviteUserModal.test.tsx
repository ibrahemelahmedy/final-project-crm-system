import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InviteUserModal } from './InviteUserModal';
import { EditUserModal } from './EditUserModal';
import * as adminApi from '../api/adminApi';
import type { AdminUser } from '../model/adminUser';

vi.mock('../api/adminApi');

const existingUser: AdminUser = {
  id: 7,
  name: 'Lena Torres',
  email: 'lena.torres@wisal.io',
  role: 'agent',
  role_label: 'Agent',
  home_route: '/dashboard',
  is_active: true,
  department: 'Billing Support',
  initials: 'LT',
  last_login_at: null,
};

function renderModal(node: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InviteUserModal', () => {
  it('renders the role select with NO blank option', () => {
    renderModal(<InviteUserModal open onClose={() => {}} />);

    const select = screen.getByLabelText('Role') as HTMLSelectElement;
    const options = within(select).getAllByRole('option') as HTMLOptionElement[];

    expect(options).toHaveLength(3);
    expect(options.map((o) => o.value)).toEqual(['agent', 'team_lead', 'administrator']);
    // Not a single empty value anywhere — an unselected role is not a state
    // this form can be in.
    expect(options.some((o) => o.value === '')).toBe(false);
    expect(options.some((o) => o.textContent?.trim() === '')).toBe(false);
  });

  it('opens on a real role rather than an empty one', () => {
    renderModal(<InviteUserModal open onClose={() => {}} />);

    expect((screen.getByLabelText('Role') as HTMLSelectElement).value).toBe('agent');
  });

  it('blocks a submit whose role is forced blank, and surfaces a field-level error', async () => {
    renderModal(<InviteUserModal open onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Person' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@wisal.io' } });

    // Force the DOM into the role-less state the select itself cannot reach —
    // the Zod schema is what has to catch it, not the markup.
    const select = screen.getByLabelText('Role') as HTMLSelectElement;
    const blank = document.createElement('option');
    blank.value = '';
    select.appendChild(blank);
    fireEvent.change(select, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));

    await screen.findByText('Select a role. Every user has exactly one.');
    expect(vi.mocked(adminApi.inviteUser)).not.toHaveBeenCalled();
  });

  it('blocks a submit with no name and no email', async () => {
    renderModal(<InviteUserModal open onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));

    await screen.findByText('Name is required');
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(vi.mocked(adminApi.inviteUser)).not.toHaveBeenCalled();
  });

  it('blocks a malformed email', async () => {
    renderModal(<InviteUserModal open onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Person' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));

    await screen.findByText('Enter a valid email address');
    expect(vi.mocked(adminApi.inviteUser)).not.toHaveBeenCalled();
  });

  it('submits a valid invite with the selected role', async () => {
    vi.mocked(adminApi.inviteUser).mockResolvedValue({ ...existingUser, id: 12 });
    const onClose = vi.fn();

    renderModal(<InviteUserModal open onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kenji Matsuda' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'kenji.m@wisal.io' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'administrator' } });
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'Platform' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));

    await waitFor(() =>
      expect(vi.mocked(adminApi.inviteUser)).toHaveBeenCalledWith({
        name: 'Kenji Matsuda',
        email: 'kenji.m@wisal.io',
        role: 'administrator',
        department: 'Platform',
      })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('attaches a servers duplicate-email 422 to the email field', async () => {
    const error = Object.assign(new Error('422'), {
      isAxiosError: true,
      response: { status: 422, data: { errors: { email: ['A user with this email address already exists.'] } } },
    });
    vi.mocked(adminApi.inviteUser).mockRejectedValue(error);
    const onClose = vi.fn();

    renderModal(<InviteUserModal open onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Duplicate' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'taken@wisal.io' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));

    await screen.findByText('A user with this email address already exists.');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('EditUserModal', () => {
  it('seeds the form from the user, including their current role', () => {
    renderModal(<EditUserModal open user={existingUser} onClose={() => {}} />);

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Lena Torres');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('lena.torres@wisal.io');
    expect((screen.getByLabelText('Role') as HTMLSelectElement).value).toBe('agent');
    expect((screen.getByLabelText('Department') as HTMLInputElement).value).toBe('Billing Support');
  });

  it('sends a role change through the update endpoint', async () => {
    vi.mocked(adminApi.updateUser).mockResolvedValue({ ...existingUser, role: 'team_lead' });

    renderModal(<EditUserModal open user={existingUser} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'team_lead' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(vi.mocked(adminApi.updateUser)).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ role: 'team_lead' })
      )
    );
  });

  it('sends a cleared department as an empty string the api layer nulls out', async () => {
    vi.mocked(adminApi.updateUser).mockResolvedValue({ ...existingUser, department: null });

    renderModal(<EditUserModal open user={existingUser} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('Department'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(vi.mocked(adminApi.updateUser)).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ department: '' })
      )
    );
  });

  it('surfaces the last-Administrator rule when the server rejects a downgrade', async () => {
    const error = Object.assign(new Error('422'), {
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          errors: {
            role: ['The last active Administrator cannot be downgraded. Promote another user first.'],
          },
        },
      },
    });
    vi.mocked(adminApi.updateUser).mockRejectedValue(error);

    renderModal(
      <EditUserModal
        open
        user={{ ...existingUser, role: 'administrator', role_label: 'Administrator' }}
        onClose={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'agent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await screen.findByText(
      'The last active Administrator cannot be downgraded. Promote another user first.'
    );
  });
});
