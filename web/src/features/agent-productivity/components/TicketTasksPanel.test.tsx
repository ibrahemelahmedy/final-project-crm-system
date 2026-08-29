import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketTasksPanel } from './TicketTasksPanel';
import { ProductivityHarness } from '../testUtils';
import { makeTask, agentUser } from '../testFixtures';
import * as tasksApi from '../api/tasksApi';
import * as mentionsApi from '../api/mentionsApi';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { post: vi.fn(), get: vi.fn() } };
});

vi.mock('../api/tasksApi');
vi.mock('../api/mentionsApi');

const tasksMocked = tasksApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mentionsMocked = mentionsApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderPanel() {
  return render(
    <ProductivityHarness>
      <TicketTasksPanel ticketId={4821} />
    </ProductivityHarness>
  );
}

describe('TicketTasksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mentionsMocked.fetchMentionableUsers.mockResolvedValue([]);
  });

  it('renders the loading state, then the success state', async () => {
    // A promise that resolves on the next tick — long enough to observe the
    // loading skeleton (which the async auth harness also needs a tick for),
    // short enough that the test does not need fake timers.
    tasksMocked.fetchTicketTasks.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([makeTask()]), 10))
    );
    renderPanel();

    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeTruthy());
    expect(await screen.findByText('Call customer back')).toBeInTheDocument();
  });

  it('renders the error state with Retry', async () => {
    tasksMocked.fetchTicketTasks.mockRejectedValue(new Error('network'));
    renderPanel();

    expect(await screen.findByText("Couldn't load tasks")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders the empty state', async () => {
    tasksMocked.fetchTicketTasks.mockResolvedValue([]);
    renderPanel();

    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
  });

  it('maps due_state to the artboard label text', async () => {
    tasksMocked.fetchTicketTasks.mockResolvedValue([
      makeTask({ id: 1, title: 'Overdue task', due_state: 'overdue', due_at: new Date(Date.now() - 86_400_000).toISOString() }),
      makeTask({ id: 2, title: 'Completed task', status: 'completed', due_state: 'none', completed_at: '2026-08-24T00:00:00.000000Z' }),
    ]);
    renderPanel();

    expect(await screen.findByText(/Overdue ·/)).toBeInTheDocument();
    expect(await screen.findByText(/Completed ·/)).toBeInTheDocument();
  });

  it('defaults the add-task form assignee to the current user', async () => {
    tasksMocked.fetchTicketTasks.mockResolvedValue([]);
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Add a task' }));

    const select = (await screen.findByText('Assignee')).parentElement!.querySelector('select')!;
    expect(select.value).toBe(String(agentUser.id));
    expect(screen.getByText(`${agentUser.name} (me)`)).toBeInTheDocument();
  });
});
