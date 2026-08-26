import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { AuthProvider } from './AuthContext';
import { UiPreferencesProvider } from '../../app/providers/UiPreferencesContext';
import { api } from '../../lib/api';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return {
    ...actual,
    api: {
      post: vi.fn(),
    },
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A fresh QueryClient per test — sharing the app singleton lets state
  // (e.g. a previous test's 429) leak into the next test's assertions.
  const renderComponent = () => {
    const testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
      <QueryClientProvider client={testQueryClient}>
        <UiPreferencesProvider>
          <MemoryRouter>
            <AuthProvider>
              <LoginPage />
            </AuthProvider>
          </MemoryRouter>
        </UiPreferencesProvider>
      </QueryClientProvider>
    );
  };

  it('renders login form with all inputs and submit button', () => {
    renderComponent();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('displays field validation errors for empty submit', async () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    });
  });

  it('blocks submission and shows a field error when the email is malformed, without a network request', async () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Enter a valid email address/i)).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('disables both inputs and shows the signing-in spinner while the request is pending', async () => {
    let resolveLogin: (value: unknown) => void = () => {};
    (api.post as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );

    renderComponent();

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'agent@wisal.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Email address/i)).toBeDisabled();
      expect(screen.getByLabelText(/Password/i)).toBeDisabled();
      const button = screen.getByRole('button', { name: /Signing in/i });
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeDisabled();
    });

    // Avoid an unresolved promise leaking into the next test.
    resolveLogin({ data: { token: 't', user: { home_route: '/dashboard' } } });
  });

  it("renders the API's email error verbatim with an alert role", async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: {
        status: 422,
        headers: {},
        data: { errors: { email: ['These credentials do not match our records.'] } },
      },
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'agent@wisal.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('These credentials do not match our records.');
    });
  });

  it('renders the deactivated-account message when the API returns it', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: {
        status: 422,
        headers: {},
        data: { errors: { email: ['This account has been deactivated. Contact your administrator.'] } },
      },
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'disabled@wisal.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/This account has been deactivated\. Contact your administrator\./i)
      ).toBeInTheDocument();
    });
  });

  it('shows rate limit alert and disables submit when receiving 429 response', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: {
        status: 429,
        headers: { 'retry-after': '45' },
        data: { message: 'Too Many Attempts.' },
      },
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'agent@wisal.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Password123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Too many attempts. Try again in 45 seconds./i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign in/i })).toBeDisabled();
    });
  });

  it('counts a 429 down and re-enables the form at zero', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: {
        status: 429,
        headers: { 'retry-after': '2' },
        data: { message: 'Too Many Attempts.' },
      },
    });

    renderComponent();

    await userEvent.setup({ delay: null }).type(screen.getByLabelText(/Email address/i), 'agent@wisal.test');
    await userEvent.setup({ delay: null }).type(screen.getByLabelText(/Password/i), 'Password123!');
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Try again in 2 seconds\./i)).toBeInTheDocument();
    });

    await vi.advanceTimersByTimeAsync(2100);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sign in/i })).not.toBeDisabled();
    });

    vi.useRealTimers();
  });

  it('does not retry a failed login', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { status: 422, headers: {}, data: { errors: { email: ['bad'] } } },
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'agent@wisal.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('navigates an Agent to /dashboard after login', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        token: 'test-token',
        user: {
          id: 1,
          name: 'Agent One',
          email: 'agent@wisal.test',
          role: 'agent',
          role_label: 'Agent',
          home_route: '/dashboard',
          is_active: true,
        },
      },
    });

    const testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={testQueryClient}>
        <UiPreferencesProvider>
          <MemoryRouter initialEntries={['/login']}>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/dashboard" element={<div>landed:/dashboard</div>} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        </UiPreferencesProvider>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'agent@wisal.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('landed:/dashboard')).toBeInTheDocument();
    });
  });

  it('navigates an Administrator to /dashboard/admin after login', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        token: 'test-token',
        user: {
          id: 4,
          name: 'Admin',
          email: 'admin@wisal.test',
          role: 'administrator',
          role_label: 'Administrator',
          home_route: '/dashboard/admin',
          is_active: true,
        },
      },
    });

    const testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={testQueryClient}>
        <UiPreferencesProvider>
          <MemoryRouter initialEntries={['/login']}>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/dashboard/admin" element={<div>landed:/dashboard/admin</div>} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        </UiPreferencesProvider>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'admin@wisal.test' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('landed:/dashboard/admin')).toBeInTheDocument();
    });
  });

  it('keeps a visible focus ring on both inputs and the submit button', async () => {
    renderComponent();

    const emailInput = screen.getByLabelText(/Email address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const button = screen.getByRole('button', { name: /Sign in/i });

    // Inputs carry the fv class which provides the focus-visible outline rule
    expect(emailInput.className).toContain('fv');
    expect(passwordInput.className).toContain('fv');

    // Button also carries fv
    button.focus();
    expect(button).toHaveFocus();
    expect(button.className).toContain('fv');
  });
});
