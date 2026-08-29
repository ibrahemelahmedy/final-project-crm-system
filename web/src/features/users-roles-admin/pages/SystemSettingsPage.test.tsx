import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SystemSettingsPage } from './SystemSettingsPage';
import * as adminApi from '../api/adminApi';
import type { SystemSetting } from '../model/adminUser';

vi.mock('../api/adminApi');

const minLength: SystemSetting = {
  key: 'password_min_length',
  label: 'Minimum password length',
  type: 'integer',
  value: 8,
  default: 8,
  help: 'Characters required in an internal user password. Cannot be lower than 8.',
  min: 8,
  max: 128,
  updated_at: null,
};

const retention: SystemSetting = {
  key: 'audit_log_retention_days',
  label: 'Audit log retention (days)',
  type: 'integer',
  value: 365,
  default: 365,
  help: 'How long audit entries are kept. Never lower than 30 days.',
  min: 30,
  max: 3650,
  updated_at: null,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SystemSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SystemSettingsPage', () => {
  it('renders each setting with its current value and bounds', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue([minLength, retention]);

    renderPage();

    const input = (await screen.findByLabelText('Minimum password length')) as HTMLInputElement;
    expect(input.value).toBe('8');
    expect(input.min).toBe('8');
    expect(input.max).toBe('128');
    expect(screen.getByText('8–128')).toBeInTheDocument();
    expect(screen.getByLabelText('Audit log retention (days)')).toBeInTheDocument();
  });

  it('blocks a 0 minimum length client-side and issues no request', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue([minLength]);

    renderPage();

    const input = await screen.findByLabelText('Minimum password length');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await screen.findByText('Minimum password length cannot be lower than 8.');
    expect(vi.mocked(adminApi.updateSettings)).not.toHaveBeenCalled();
  });

  it('blocks a negative minimum length client-side', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue([minLength]);

    renderPage();

    const input = await screen.findByLabelText('Minimum password length');
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await screen.findByText('Minimum password length cannot be lower than 8.');
    expect(vi.mocked(adminApi.updateSettings)).not.toHaveBeenCalled();
  });

  it('blocks a non-numeric value client-side', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue([minLength]);

    renderPage();

    const input = await screen.findByLabelText('Minimum password length');
    fireEvent.change(input, { target: { value: 'eight' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => expect(vi.mocked(adminApi.updateSettings)).not.toHaveBeenCalled());
    expect(document.querySelector('.form-error')).toBeTruthy();
  });

  it('blocks a value above the ceiling client-side', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue([minLength]);

    renderPage();

    const input = await screen.findByLabelText('Minimum password length');
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await screen.findByText('Minimum password length cannot be higher than 128.');
    expect(vi.mocked(adminApi.updateSettings)).not.toHaveBeenCalled();
  });

  it('surfaces the SERVER error when the client check is bypassed', async () => {
    // The client rules are built from the server's own metadata; a payload
    // whose bounds say 0 is allowed is exactly the "client check bypassed"
    // case, and the server's 422 must still reach the field.
    vi.mocked(adminApi.getSettings).mockResolvedValue([{ ...minLength, min: 0 }]);

    const error = Object.assign(new Error('422'), {
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          errors: {
            'settings.password_min_length': [
              'The Minimum password length field must be at least 8.',
            ],
          },
        },
      },
    });
    vi.mocked(adminApi.updateSettings).mockRejectedValue(error);

    renderPage();

    const input = await screen.findByLabelText('Minimum password length');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    // The client let it through, the server did not, and the message lands on
    // the field rather than vanishing.
    await waitFor(() => expect(vi.mocked(adminApi.updateSettings)).toHaveBeenCalledWith({ password_min_length: 0 }));
    await screen.findByText('The Minimum password length field must be at least 8.');
  });

  it('persists a valid change and confirms what was saved', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue([minLength]);
    vi.mocked(adminApi.updateSettings).mockResolvedValue({
      data: [{ ...minLength, value: 14 }],
      changed: ['password_min_length'],
    });

    renderPage();

    const input = await screen.findByLabelText('Minimum password length');
    fireEvent.change(input, { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() =>
      expect(vi.mocked(adminApi.updateSettings)).toHaveBeenCalledWith({ password_min_length: 14 })
    );
    await screen.findByText('Saved 1 change(s).');
  });

  it('reports when nothing actually changed', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue([minLength]);
    vi.mocked(adminApi.updateSettings).mockResolvedValue({ data: [minLength], changed: [] });

    renderPage();

    await screen.findByLabelText('Minimum password length');
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await screen.findByText('No changes to save.');
  });

  it('renders the Loading state', async () => {
    vi.mocked(adminApi.getSettings).mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() => expect(container.querySelector('.sk')).toBeTruthy());
  });

  it('renders the Error state and retries', async () => {
    vi.mocked(adminApi.getSettings).mockRejectedValue(new Error('boom'));

    renderPage();

    const retry = await screen.findByRole('button', { name: /retry|try again/i });

    vi.mocked(adminApi.getSettings).mockResolvedValue([minLength]);
    fireEvent.click(retry);

    await screen.findByLabelText('Minimum password length');
  });

  it('renders the Empty state when nothing is configurable', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue([]);

    renderPage();

    await screen.findByText('No configurable settings.');
  });

  it('resets edited values back to the loaded ones', async () => {
    vi.mocked(adminApi.getSettings).mockResolvedValue([minLength]);

    renderPage();

    const input = (await screen.findByLabelText('Minimum password length')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20' } });
    expect(input.value).toBe('20');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() => expect(input.value).toBe('8'));
  });
});
