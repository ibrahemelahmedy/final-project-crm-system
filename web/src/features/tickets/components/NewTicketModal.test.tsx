import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewTicketModal } from './NewTicketModal';
import { api } from '../../../lib/api';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;
const post = api.post as ReturnType<typeof vi.fn>;

const META = {
  priorities: [{ value: 'high', label: 'High' }],
  statuses: [{ value: 'open', label: 'Open' }],
  channels: [{ value: 'email', label: 'Email' }],
  categories: [{ value: 'account', label: 'Account' }],
  agents: [],
};

function renderModal(onClose = vi.fn(), onCreated = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NewTicketModal meta={META} onClose={onClose} onCreated={onCreated} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...utils, onClose, onCreated };
}

/** Picks a customer through the combobox, which is the only way to set customer_id. */
async function pickCustomer() {
  get.mockResolvedValue({
    data: { data: [{ id: 12, name: 'Amelia Chen', company: 'Northwind', initials: 'AC' }] },
  });
  fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'Amelia' } });
  const option = await screen.findByRole('option', { name: /Amelia Chen/ });
  fireEvent.mouseDown(option);
}

describe('NewTicketModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks submit until a customer is chosen', () => {
    renderModal();
    // customer_id is the one field with no default, so the submit stays
    // disabled until the combobox supplies it.
    expect(screen.getByRole('button', { name: 'Create Ticket' })).toBeDisabled();
  });

  it('requires a subject and a category', async () => {
    renderModal();
    await pickCustomer();

    fireEvent.click(screen.getByRole('button', { name: 'Create Ticket' }));

    expect(await screen.findByText('Subject is required')).toBeInTheDocument();
    // "Select a category" is also the placeholder <option>, so scope to the
    // error elements rather than matching the text document-wide.
    const errors = [...document.querySelectorAll('.tq-field-error')].map((e) => e.textContent);
    expect(errors).toContain('Select a category');
    expect(post).not.toHaveBeenCalled();
  });

  it('submits customer_id, never a name string', async () => {
    post.mockResolvedValue({ data: { data: { id: 1 } } });
    const { onCreated } = renderModal();

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'VPN drops' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'account' } });
    await pickCustomer();

    fireEvent.click(screen.getByRole('button', { name: 'Create Ticket' }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({
      subject: 'VPN drops',
      customer_id: 12,
      category: 'account',
      priority: 'normal',
      channel: 'email',
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it('maps a 422 field error onto its input', async () => {
    post.mockRejectedValue({
      response: { status: 422, data: { errors: { subject: ['That subject is already in use.'] } } },
    });
    renderModal();

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'VPN drops' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'account' } });
    await pickCustomer();

    fireEvent.click(screen.getByRole('button', { name: 'Create Ticket' }));

    // The server message renders verbatim — never swallowed into a generic one.
    expect(await screen.findByText('That subject is already in use.')).toBeInTheDocument();
  });

  it('exposes the priority control as a radiogroup', () => {
    renderModal();
    const group = screen.getByRole('radiogroup', { name: 'Priority' });
    expect(group).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    // Roving tabIndex: exactly one stop for the whole group.
    expect(radios.filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Normal' })).toHaveAttribute('aria-checked', 'true');
  });

  it('renders the attachments dropzone inert with no file input', () => {
    renderModal();
    // The modal is portaled to document.body, so `container` is empty.
    const dropzone = document.querySelector('.tq-dropzone');

    expect(dropzone).toHaveAttribute('aria-hidden', 'true');
    expect(dropzone).toHaveAttribute('title', 'Coming soon');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('closes on Escape and returns focus to the invoker', async () => {
    const invoker = document.createElement('button');
    document.body.appendChild(invoker);
    invoker.focus();

    const { onClose, unmount } = renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    // The cleanup form is what restores focus even when no onClose path ran.
    unmount();
    await waitFor(() => expect(invoker).toHaveFocus());
    invoker.remove();
  });
});
