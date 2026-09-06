import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { PortalAccessPage } from './PortalAccessPage';
import * as portalApi from '../api/portalApi';
import { renderPortal, pending } from '../testUtils';

vi.mock('../api/portalApi');

const requestCode = vi.mocked(portalApi.requestAccessCode);
const verifyCode = vi.mocked(portalApi.verifyAccessCode);

const accepted = (resendAfter = 60) => ({
  sent: true,
  masked_identifier: 'd•••@example.com',
  resend_after_seconds: resendAfter,
});

const axiosStatus = (status: number, data: unknown = {}) =>
  new AxiosError('Failed', String(status), undefined, null, {
    status,
    statusText: 'Error',
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

/** Drive the page to step 2 with a delivered code. */
async function reachCodeStep(user: ReturnType<typeof userEvent.setup>, resendAfter = 60) {
  requestCode.mockResolvedValue(accepted(resendAfter));
  await user.type(screen.getByLabelText('Email or phone number'), 'dana@example.com');
  await user.click(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByText('Code sent to d•••@example.com');
}

const digits = () => screen.getAllByRole('textbox') as HTMLInputElement[];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PortalAccessPage', () => {
  describe('step 1 — identifier', () => {
    it('renders the idle artboard', () => {
      renderPortal(<PortalAccessPage />);

      expect(screen.getByRole('heading', { name: 'Track your request' })).toBeInTheDocument();
      expect(screen.getByLabelText('Email or phone number')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send code' })).toBeInTheDocument();
    });

    it('offers the FAQ route with no session (AC6)', () => {
      renderPortal(<PortalAccessPage />);

      expect(screen.getByRole('link', { name: 'Browse our FAQs' })).toHaveAttribute(
        'href',
        '/portal/faq'
      );
    });

    it('shows an inline field error for an empty identifier and never calls the API', async () => {
      const user = userEvent.setup();
      renderPortal(<PortalAccessPage />);

      await user.click(screen.getByRole('button', { name: 'Send code' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Enter a valid email address or phone number.'
      );
      expect(requestCode).not.toHaveBeenCalled();
    });

    it('disables the button while the request is in flight (Submitting artboard)', async () => {
      const user = userEvent.setup();
      requestCode.mockReturnValue(pending());
      renderPortal(<PortalAccessPage />);

      await user.type(screen.getByLabelText('Email or phone number'), 'dana@example.com');
      await user.click(screen.getByRole('button', { name: 'Send code' }));

      expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled();
    });

    it('surfaces a 422 format failure inline (Error Format artboard)', async () => {
      const user = userEvent.setup();
      requestCode.mockRejectedValue(axiosStatus(422));
      renderPortal(<PortalAccessPage />);

      await user.type(screen.getByLabelText('Email or phone number'), 'not-an-identifier');
      await user.click(screen.getByRole('button', { name: 'Send code' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Enter a valid email address or phone number.'
      );
      expect(screen.getByRole('button', { name: 'Send code' })).toBeInTheDocument();
    });

    it('advances to step 2 on the always-202 response, showing the masked identifier', async () => {
      const user = userEvent.setup();
      renderPortal(<PortalAccessPage />);
      await reachCodeStep(user);

      expect(requestCode).toHaveBeenCalledWith('dana@example.com');
      expect(screen.getByText('Verification code')).toBeInTheDocument();
      expect(digits()).toHaveLength(6);
    });
  });

  describe('step 2 — code', () => {
    it('keeps Verify disabled until six digits are entered', async () => {
      const user = userEvent.setup();
      renderPortal(<PortalAccessPage />);
      await reachCodeStep(user);

      expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();

      await user.click(digits()[0]);
      await user.paste('123456');

      expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled();
    });

    it('verifies and stores the session on success', async () => {
      const user = userEvent.setup();
      verifyCode.mockResolvedValue({
        token: 'portal-token-abc',
        expires_at: '2026-09-04T00:00:00Z',
        customer: { id: 1, name: 'Dana Ruiz', masked_identifier: 'd•••@example.com' },
      });
      renderPortal(<PortalAccessPage />, { path: '/portal', route: '/portal' });
      await reachCodeStep(user);

      await user.click(digits()[0]);
      await user.paste('123456');
      await user.click(screen.getByRole('button', { name: 'Verify' }));

      await waitFor(() => expect(verifyCode).toHaveBeenCalledWith('dana@example.com', '123456'));
      await waitFor(() => expect(sessionStorage.getItem('wisal-portal-token')).toBe('portal-token-abc'));
    });

    it('disables the boxes while verifying (Submitting artboard)', async () => {
      const user = userEvent.setup();
      verifyCode.mockReturnValue(pending());
      renderPortal(<PortalAccessPage />);
      await reachCodeStep(user);

      await user.click(digits()[0]);
      await user.paste('123456');
      await user.click(screen.getByRole('button', { name: 'Verify' }));

      await waitFor(() => expect(digits()[0]).toBeDisabled());
      expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDisabled();
    });

    it('shows the remaining attempts on a 422 (Error Wrong artboard)', async () => {
      const user = userEvent.setup();
      verifyCode.mockRejectedValue(axiosStatus(422, { message: 'Incorrect code.', attempts_remaining: 3 }));
      renderPortal(<PortalAccessPage />);
      await reachCodeStep(user);

      await user.click(digits()[0]);
      await user.paste('000000');
      await user.click(screen.getByRole('button', { name: 'Verify' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('3 attempts remaining.');
      // Still usable — a wrong code is not a dead end.
      expect(digits()[0]).toBeEnabled();
    });

    it('locks the boxes on a 410 and offers a resend (Error Expired artboard)', async () => {
      const user = userEvent.setup();
      verifyCode.mockRejectedValue(axiosStatus(410, { message: 'Expired.', attempts_remaining: 0 }));
      renderPortal(<PortalAccessPage />);
      await reachCodeStep(user, 0);

      await user.click(digits()[0]);
      await user.paste('123456');
      await user.click(screen.getByRole('button', { name: 'Verify' }));

      expect(await screen.findByText(/This code has expired/)).toBeInTheDocument();
      await waitFor(() => expect(digits()[0]).toBeDisabled());
      expect(screen.getByRole('button', { name: 'Resend code' })).toBeInTheDocument();
    });
  });

  describe('resend cooldown', () => {
    it('counts down from the API resend_after_seconds, not a hard-coded 60', async () => {
      const user = userEvent.setup();
      renderPortal(<PortalAccessPage />);
      await reachCodeStep(user, 90);

      // 90s, rendered m:ss — proof the value came from the response body.
      expect(await screen.findByText('1:30')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Resend code' })).not.toBeInTheDocument();
    });

    it('offers Resend once the cooldown has elapsed (Resend Available artboard)', async () => {
      const user = userEvent.setup();
      renderPortal(<PortalAccessPage />);
      await reachCodeStep(user, 0);

      const resend = await screen.findByRole('button', { name: 'Resend code' });
      await user.click(resend);

      await waitFor(() => expect(requestCode).toHaveBeenCalledTimes(2));
      expect(requestCode).toHaveBeenLastCalledWith('dana@example.com');
    });
  });
});
