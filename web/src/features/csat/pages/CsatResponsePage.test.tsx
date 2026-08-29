import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CsatResponsePage } from './CsatResponsePage';
import * as csatApi from '../api/csatApi';
import type { CsatSurvey } from '../model/csat';

vi.mock('../api/csatApi');

const fetchMock = vi.mocked(csatApi.fetchCsatSurvey);
const submitMock = vi.mocked(csatApi.submitCsatResponse);

function outstanding(): CsatSurvey {
  return {
    state: 'outstanding',
    ticket: { number: '#4821', subject: 'Payment not going through' },
    rating: null,
    comment: null,
    responded_at: null,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/feedback/abc-123']}>
        <Routes>
          <Route path="/feedback/:uuid" element={<CsatResponsePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CsatResponsePage', () => {
  it('shows a loading skeleton while the survey loads', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders the idle feedback form', async () => {
    fetchMock.mockResolvedValue(outstanding());
    renderPage();
    expect(await screen.findByText('How did we do?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit feedback' })).toBeDisabled();
    expect(screen.getByText('Request #4821 · "Payment not going through"')).toBeInTheDocument();
  });

  it('submits a rating + comment and shows the thank-you state; control is disabled while submitting', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(outstanding());
    let resolveSubmit: (v: CsatSurvey) => void = () => {};
    submitMock.mockReturnValue(new Promise((r) => { resolveSubmit = r; }));

    renderPage();
    await screen.findByText('How did we do?');

    await user.click(screen.getByRole('radio', { name: '4 – Good' }));
    await user.type(screen.getByLabelText(/Comment/), 'Great help');
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();

    resolveSubmit({ ...outstanding(), state: 'answered', rating: 4, comment: 'Great help', responded_at: '2026-08-26T10:00:00Z' });
    fetchMock.mockResolvedValue({ ...outstanding(), state: 'answered', rating: 4, comment: 'Great help', responded_at: '2026-08-26T10:00:00Z' });

    expect(await screen.findByText('Thank you for your feedback')).toBeInTheDocument();
  });

  it('renders the already-answered recap read-only with no submit control in the DOM', async () => {
    fetchMock.mockResolvedValue({
      state: 'answered',
      ticket: { number: '#4821', subject: 'Payment not going through' },
      rating: 4,
      comment: 'The agent was helpful.',
      responded_at: '2026-08-26T10:00:00Z',
    });
    renderPage();

    expect(await screen.findByText("You've already responded")).toBeInTheDocument();
    expect(screen.getByText('The agent was helpful.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit feedback/ })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('renders the calm expired card', async () => {
    fetchMock.mockResolvedValue({ state: 'expired', ticket: null, rating: null, comment: null, responded_at: null });
    renderPage();
    expect(await screen.findByText('This link is no longer active')).toBeInTheDocument();
  });

  it('renders a retryable error card on a failed fetch', async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new Error('network'));
    fetchMock.mockResolvedValueOnce(outstanding());
    renderPage();

    const retry = await screen.findByRole('button', { name: 'Retry' });
    await user.click(retry);
    expect(await screen.findByText('How did we do?')).toBeInTheDocument();
  });

  it('lets the visitor override the detected locale with the on-page toggle', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(outstanding());
    renderPage();
    await screen.findByText('How did we do?');

    await user.click(screen.getByRole('button', { name: 'العربية' }));
    expect(await screen.findByText('كيف كان أداؤنا؟')).toBeInTheDocument();
  });
});
