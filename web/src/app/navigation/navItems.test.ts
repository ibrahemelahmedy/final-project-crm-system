import { describe, it, expect } from 'vitest';
import { navItems, visibleNavItems } from './navItems';

describe('navItems manifest', () => {
  it('exposes exactly nine items', () => {
    // Story 10 adds Quick Replies (admin group, team_lead/administrator).
    expect(navItems).toHaveLength(9);
  });

  it('hides the admin group and Reports from an agent', () => {
    const items = visibleNavItems('agent');
    // Story 12: Reports is now team_lead/administrator only.
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.to)).not.toContain('/sla-rules');
    expect(items.map((i) => i.to)).not.toContain('/users');
    expect(items.map((i) => i.to)).not.toContain('/reports');
    expect(items.map((i) => i.to)).not.toContain('/quick-replies');
  });

  it('shows Quick Replies and Reports, but hides SLA Rules and Users, from a team lead', () => {
    const items = visibleNavItems('team_lead');
    expect(items).toHaveLength(7);
    expect(items.map((i) => i.to)).toContain('/quick-replies');
    expect(items.map((i) => i.to)).not.toContain('/sla-rules');
    expect(items.map((i) => i.to)).not.toContain('/users');
  });

  it('shows all nine items to an administrator', () => {
    const items = visibleNavItems('administrator');
    expect(items).toHaveLength(9);
    expect(items.map((i) => i.to)).toContain('/sla-rules');
    expect(items.map((i) => i.to)).toContain('/users');
    expect(items.map((i) => i.to)).toContain('/quick-replies');
  });
});
