import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClassificationCard } from './ClassificationCard';
import { makeTicket, renderWithProviders } from './testUtils';
import type { TicketAiClassification } from '../../model/ticket';

vi.mock('../../api/ticketsApi', async () => {
  const actual = await vi.importActual('../../api/ticketsApi');
  return {
    ...actual,
    updateTicket: vi.fn().mockResolvedValue({}),
    dismissClassification: vi.fn().mockResolvedValue(undefined),
  };
});

import { updateTicket, dismissClassification } from '../../api/ticketsApi';

function classification(overrides: Partial<TicketAiClassification> = {}): TicketAiClassification {
  return {
    suggested_category: 'billing',
    suggested_category_label: 'Billing',
    suggested_priority: 'urgent',
    suggested_priority_label: 'Urgent',
    confidence: 0.92,
    needs_triage: false,
    classified_at: '2026-09-09T07:00:00.000000Z',
    ...overrides,
  };
}

describe('ClassificationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing extra when ai_classification is null', () => {
    renderWithProviders(<ClassificationCard ticket={makeTicket({ ai_classification: null })} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the suggestion row and the confidence percentage when it differs', () => {
    renderWithProviders(
      <ClassificationCard
        ticket={makeTicket({ category: 'technical', priority: 'high', ai_classification: classification() })}
      />
    );

    expect(screen.getByText('AI suggests Billing · Urgent')).toBeInTheDocument();
    expect(screen.getByText('92% confident')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('renders nothing when the suggestion already matches the live values', () => {
    renderWithProviders(
      <ClassificationCard
        ticket={makeTicket({
          category: 'billing',
          priority: 'urgent',
          ai_classification: classification(),
        })}
      />
    );

    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the needs-triage pill and a Dismiss button when nothing was suggested', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ClassificationCard
        ticket={makeTicket({
          ai_classification: classification({
            suggested_category: null,
            suggested_category_label: null,
            suggested_priority: null,
            suggested_priority_label: null,
            confidence: 0.2,
            needs_triage: true,
          }),
        })}
      />
    );

    expect(screen.getByText('Needs triage')).toBeInTheDocument();
    expect(screen.getByText("The assistant wasn't confident enough to suggest anything.")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(dismissClassification).toHaveBeenCalledWith(4821));
  });

  it('applies the suggestion through the attribute mutation with both fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ClassificationCard
        ticket={makeTicket({ category: 'technical', priority: 'high', ai_classification: classification() })}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(updateTicket).toHaveBeenCalledWith(4821, { category: 'billing', priority: 'urgent' })
    );
  });

  it('wraps the suggestion in the AI card with the Latin AI pill and an actions row', () => {
    const { container } = renderWithProviders(
      <ClassificationCard
        ticket={makeTicket({ category: 'technical', priority: 'high', ai_classification: classification() })}
      />
    );

    const card = screen.getByRole('status');
    expect(card).toHaveClass('classification-ai');

    const pill = container.querySelector('.assist-chip');
    expect(pill).toHaveTextContent('AI');
    expect(pill).toHaveAttribute('dir', 'ltr');

    expect(container.querySelector('.classification-ai-actions')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveClass('classification-ai-btn--apply');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass('classification-ai-btn');
    expect(container.querySelector('.classification-ai-note--meta')).toHaveTextContent('92% confident');
  });

  it('puts the needs-triage pill and the AI pill on one head row', () => {
    const { container } = renderWithProviders(
      <ClassificationCard
        ticket={makeTicket({
          ai_classification: classification({
            suggested_category: null,
            suggested_category_label: null,
            suggested_priority: null,
            suggested_priority_label: null,
            confidence: 0.2,
            needs_triage: true,
          }),
        })}
      />
    );

    const head = container.querySelector('.classification-ai-head');
    expect(head).not.toBeNull();
    expect(head!.querySelector('.assist-chip')).toHaveTextContent('AI');
    expect(head!.querySelector('.classification-chip-triage')).toHaveTextContent('Needs triage');
  });

  it('renders no AI card at all when there is nothing to suggest', () => {
    const { container } = renderWithProviders(
      <ClassificationCard ticket={makeTicket({ ai_classification: null })} />
    );

    expect(container.querySelector('.classification-ai')).toBeNull();
    expect(container.querySelector('.assist-chip')).toBeNull();
  });
});
