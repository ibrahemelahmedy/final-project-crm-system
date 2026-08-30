import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SlaRulesPage } from './SlaRulesPage';
import { I18nextProvider, i18n } from '../../../i18n';
import { api } from '../../../lib/api';
import type { SlaRule } from '../model/types';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;
const patch = api.patch as ReturnType<typeof vi.fn>;

function rule(overrides: Partial<SlaRule> = {}): SlaRule {
  return {
    id: 1,
    priority: 'urgent',
    priority_label: 'Urgent',
    first_response_minutes: 15,
    resolution_minutes: 240,
    at_risk_threshold_pct: 80,
    notify_on_breach: true,
    escalation_enabled: true,
    escalate_after_minutes: 30,
    escalate_to_role: 'administrator',
    auto_close_after_days: 5,
    is_active: true,
    breach_action_label: 'Notify Team Lead + escalate to Administrator',
    ...overrides,
  };
}

const FOUR_TIERS: SlaRule[] = [
  rule(),
  rule({ id: 2, priority: 'high', priority_label: 'High', first_response_minutes: 60, resolution_minutes: 480, breach_action_label: 'Notify Team Lead' }),
  rule({ id: 3, priority: 'normal', priority_label: 'Normal', first_response_minutes: 240, resolution_minutes: 1440, breach_action_label: 'No escalation' }),
  rule({ id: 4, priority: 'low', priority_label: 'Low', first_response_minutes: 1440, resolution_minutes: 7200, breach_action_label: 'No escalation' }),
];

function renderPage(path = '/sla-rules') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <SlaRulesPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SlaRulesPage', () => {
  it('renders the four tier cards in the order the API returns them', async () => {
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    renderPage();

    const cards = await screen.findAllByRole('article');

    expect(cards).toHaveLength(4);
    // Server order (Priority::sortExpression desc) is never re-sorted client-side.
    expect(within(cards[0]).getByText('Urgent')).toBeInTheDocument();
    expect(within(cards[3]).getByText('Low')).toBeInTheDocument();
  });

  it('renders the Low card as 1 day / 5 days, not business days', async () => {
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    renderPage();

    const cards = await screen.findAllByRole('article');
    const low = cards[3];

    expect(within(low).getByText('1 day')).toBeInTheDocument();
    expect(within(low).getByText('5 days')).toBeInTheDocument();
  });

  it('shows the server-derived breach action sentence', async () => {
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    renderPage();

    expect(
      await screen.findByText('Notify Team Lead + escalate to Administrator'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('No escalation')).toHaveLength(2);
  });

  it('pluralises the active-rule count from the response', async () => {
    get.mockResolvedValue({ data: { data: [rule()] } });
    renderPage();

    expect(await screen.findByText('1 active rule · applied by priority')).toBeInTheDocument();
  });

  it('counts only active rules in the subtitle', async () => {
    get.mockResolvedValue({ data: { data: [rule(), rule({ id: 2, priority: 'high', is_active: false })] } });
    renderPage();

    expect(await screen.findByText('1 active rule · applied by priority')).toBeInTheDocument();
  });

  it('marks a deactivated rule with a text chip, not colour alone', async () => {
    get.mockResolvedValue({ data: { data: [rule({ is_active: false })] } });
    renderPage();

    expect(await screen.findByText('INACTIVE')).toBeInTheDocument();
  });

  it('disables Add Rule with a stated reason when all four tiers are taken', async () => {
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    renderPage();

    // The button renders during loading too, so wait for the data first.
    await screen.findAllByRole('article');
    const add = screen.getByRole('button', { name: 'Add Rule' });

    expect(add).toBeDisabled();
    expect(add).toHaveAttribute('title', 'Every priority tier already has a rule');
    expect(screen.getByText('Every priority tier already has a rule')).toBeInTheDocument();
  });

  it('enables Add Rule while a tier is vacant', async () => {
    get.mockResolvedValue({ data: { data: [rule()] } });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Add Rule' })).toBeEnabled();
  });

  it('gives every edit button an accessible name naming its tier', async () => {
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Edit the Urgent SLA rule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit the Low SLA rule' })).toBeInTheDocument();
  });

  it('shows the empty state when no rule exists, naming the consequence', async () => {
    get.mockResolvedValue({ data: { data: [] } });
    renderPage();

    expect(await screen.findByText('No SLA rules yet')).toBeInTheDocument();
    expect(
      screen.getByText('Tickets will have no response or resolution target until a rule exists.'),
    ).toBeInTheDocument();
  });

  it('shows an error state with a retry and no API detail', async () => {
    get.mockRejectedValue(new Error('Request failed with status code 500'));
    renderPage();

    const alert = await screen.findByRole('alert');

    expect(within(alert).getByText('Could not load the SLA rules')).toBeInTheDocument();
    expect(alert.textContent).not.toContain('/sla-rules');
    expect(alert.textContent).not.toContain('500');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('opens the editor from the URL and locks the tier for an existing rule', async () => {
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    renderPage('/sla-rules?edit=1');

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Edit SLA rule')).toBeInTheDocument();
    // priority is the unique key: an existing rule cannot change tier.
    expect(within(dialog).getByLabelText('Priority')).toBeDisabled();
  });

  it('opens the editor when an edit button is pressed', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit the Urgent SLA rule' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows a duration in its largest whole unit when editing', async () => {
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    renderPage('/sla-rules?edit=1');

    const dialog = await screen.findByRole('dialog');

    // 240 minutes opens as 4 + hours, matching the card.
    expect(within(dialog).getByLabelText('Resolve within')).toHaveValue(4);
  });

  it('closes the editor on Escape', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    renderPage('/sla-rules?edit=1');

    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('blocks a resolution target shorter than the response target with the server copy', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    renderPage('/sla-rules?edit=1');

    const dialog = await screen.findByRole('dialog');
    const resolve = within(dialog).getByLabelText('Resolve within');

    // 5 MINUTES against a 15-minute response target. The unit has to move too
    // — 5 hours would legitimately be longer.
    await user.selectOptions(within(dialog).getByLabelText(/Resolve within — /), 'minutes');
    await user.clear(resolve);
    await user.type(resolve, '5');

    await user.click(within(dialog).getByRole('button', { name: 'Save rule' }));

    expect(
      await within(dialog).findByText('The resolution target must be longer than the response target.'),
    ).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('saves an edited rule through PATCH', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    patch.mockResolvedValue({ data: { data: rule({ resolution_minutes: 480 }) } });
    renderPage('/sla-rules?edit=1');

    const dialog = await screen.findByRole('dialog');
    const resolve = within(dialog).getByLabelText('Resolve within');

    await user.clear(resolve);
    await user.type(resolve, '8');   // 8 hours

    await user.click(within(dialog).getByRole('button', { name: 'Save rule' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/sla-rules/1', expect.objectContaining({ resolution_minutes: 480 })),
    );
  });

  it('maps a 422 from the API onto the field', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ data: { data: FOUR_TIERS } });
    patch.mockRejectedValue({
      response: { data: { errors: { resolution_minutes: ['Server says no.'] } } },
    });
    renderPage('/sla-rules?edit=1');

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save rule' }));

    expect(await within(dialog).findByText('Server says no.')).toBeInTheDocument();
  });
});
