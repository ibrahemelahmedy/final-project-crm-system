import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { CustomerFormModal } from './CustomerFormModal';
import * as customersApi from '../api/customersApi';

vi.mock('../api/customersApi');

function renderModal(props: Partial<React.ComponentProps<typeof CustomerFormModal>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <button type="button">Trigger</button>
      <CustomerFormModal open onClose={() => {}} {...props} />
    </QueryClientProvider>
  );
}

function makeDuplicateError(id: number, name: string) {
  const error = new AxiosError('Request failed');
  error.response = {
    status: 422,
    data: {
      message: 'A customer with this email already exists.',
      errors: { email: ['A customer with this email already exists.'] },
      duplicate_customer_id: id,
      duplicate_customer_name: name,
    },
    statusText: 'Unprocessable Entity',
    headers: {},
    // @ts-expect-error minimal fake config
    config: {},
  };
  return error;
}

describe('CustomerFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a name', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
  });

  it('requires an email or a phone', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jane Doe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    expect(await screen.findByText('Add an email address or a phone number.')).toBeInTheDocument();
  });

  it('maps a 422 onto its field', async () => {
    (customersApi.createCustomer as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new AxiosError('fail'), {
        response: { status: 422, data: { errors: { email: ['That email looks wrong.'] } } },
      })
    );
    renderModal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    expect(await screen.findByText('That email looks wrong.')).toBeInTheDocument();
  });

  it('renders a link to the existing record on a duplicate', async () => {
    (customersApi.createCustomer as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      makeDuplicateError(12, 'Amelia Chen')
    );
    renderModal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'amelia.chen@northwind.io' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    const link = await screen.findByRole('link', { name: 'Open Amelia Chen' });
    expect(link).toHaveAttribute('href', '/customers/12');
  });

  it('returns focus to the trigger on close', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    const onClose = vi.fn();
    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomerFormModal open onClose={onClose} />
      </QueryClientProvider>
    );
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <CustomerFormModal open={false} onClose={onClose} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.remove();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
