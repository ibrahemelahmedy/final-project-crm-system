import { describe, it, expect } from 'vitest';
import { navItems, visibleNavItems } from './navItems';

describe('navItems manifest', () => {
  it('exposes exactly eleven items', () => {
    // Story 10 adds Quick Replies (admin group, team_lead/administrator).
    // Story 18 (WIS-19) adds Integrations (admin group, administrator only).
    // Story 20 (WIS-20) adds Organization (admin group, administrator only).
    expect(navItems).toHaveLength(11);
  });

  it('hides the admin group and Reports from an agent', () => {
    const items = visibleNavItems('agent');
    // Story 12: Reports is now team_lead/administrator only.
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.to)).not.toContain('/sla-rules');
    expect(items.map((i) => i.to)).not.toContain('/users');
    expect(items.map((i) => i.to)).not.toContain('/reports');
    expect(items.map((i) => i.to)).not.toContain('/quick-replies');
    expect(items.map((i) => i.to)).not.toContain('/integrations');
    expect(items.map((i) => i.to)).not.toContain('/organization');
  });

  it('shows Quick Replies and Reports, but hides SLA Rules and Users, from a team lead', () => {
    const items = visibleNavItems('team_lead');
    expect(items).toHaveLength(7);
    expect(items.map((i) => i.to)).toContain('/quick-replies');
    expect(items.map((i) => i.to)).not.toContain('/sla-rules');
    expect(items.map((i) => i.to)).not.toContain('/users');
  });

  it('shows all eleven items to an administrator', () => {
    const items = visibleNavItems('administrator');
    expect(items).toHaveLength(11);
    expect(items.map((i) => i.to)).toContain('/sla-rules');
    expect(items.map((i) => i.to)).toContain('/users');
    expect(items.map((i) => i.to)).toContain('/quick-replies');
    expect(items.map((i) => i.to)).toContain('/integrations');
    expect(items.map((i) => i.to)).toContain('/organization');
  });

  it('hides Integrations from a team lead', () => {
    const items = visibleNavItems('team_lead');
    expect(items.map((i) => i.to)).not.toContain('/integrations');
  });

  it('hides Organization from a team lead, admin-only like Integrations', () => {
    const items = visibleNavItems('team_lead');
    expect(items.map((i) => i.to)).not.toContain('/organization');

    const orgItem = navItems.find((i) => i.to === '/organization');
    expect(orgItem?.group).toBe('admin');
    expect(orgItem?.roles).toEqual(['administrator']);
  });
});
