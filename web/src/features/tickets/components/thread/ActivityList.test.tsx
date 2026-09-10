import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import i18n from '../../../../i18n/instance';
import { ActivityList } from './ActivityList';
import type { TicketEvent } from '../../model/ticket';

/**
 * Story 28 (WIS-29), Decision 3. The activity vocabulary is pinned to the
 * backend. The 13 slugs and where the backend writes them:
 *
 *   api/app/Models/Ticket.php — created, status_changed, priority_changed,
 *     category_changed, assigned, unassigned, reopened, auto_assigned,
 *     escalated, auto_closed
 *   api/app/Http/Controllers/TicketMessageController.php — replied,
 *     internal_note_added, mentioned
 *
 * Adding a 14th event server-side and forgetting the catalogue fails this.
 */
const BACKEND_EVENT_SLUGS: Record<string, string> = {
  created: 'activity.created',
  status_changed: 'activity.statusChanged',
  priority_changed: 'activity.priorityChanged',
  category_changed: 'activity.categoryChanged',
  assigned: 'activity.assigned',
  unassigned: 'activity.unassigned',
  reopened: 'activity.reopened',
  replied: 'activity.replied',
  auto_assigned: 'activity.autoAssigned',
  escalated: 'activity.escalated',
  auto_closed: 'activity.autoClosed',
  internal_note_added: 'activity.internalNoteAdded',
  mentioned: 'activity.mentioned',
};

function event(overrides: Partial<TicketEvent> = {}): TicketEvent {
  return {
    id: 1,
    event: 'created',
    field: null,
    old_value: null,
    new_value: null,
    actor: { id: 3, name: 'Sarah Ahmed' },
    created_at: '2026-08-26T09:12:00.000000Z',
    ...overrides,
  };
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('ActivityList', () => {
  it('every backend event slug resolves to a real conversation:activity.* key in both locales', () => {
    for (const [slug, key] of Object.entries(BACKEND_EVENT_SLUGS)) {
      for (const lng of ['en', 'ar'] as const) {
        expect(
          i18n.exists(key, { ns: 'conversation', lng, fallbackLng: [] }),
          `${slug} -> conversation:${key} missing in ${lng}`,
        ).toBe(true);
      }
    }
  });

  it('renders a status_changed row in Arabic with the translated status, not the raw enum value', async () => {
    await i18n.changeLanguage('ar');

    render(
      <ActivityList
        events={[event({ event: 'status_changed', field: 'status', new_value: 'resolved' })]}
      />,
    );

    const row = screen.getByRole('listitem');
    expect(row.textContent).toContain('محلولة');
    expect(row.textContent).not.toContain('resolved');
  });

  it('falls back to the generic sentence with the raw slug for an unmapped event', () => {
    render(<ActivityList events={[event({ event: 'some_future_event' })]} />);
    expect(screen.getByRole('listitem').textContent).toContain('some_future_event');
  });
});
