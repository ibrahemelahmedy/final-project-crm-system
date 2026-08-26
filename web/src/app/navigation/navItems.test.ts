import { describe, it, expect } from 'vitest';
import { navItems, visibleNavItems } from './navItems';

describe('navItems manifest', () => {
  it('exposes exactly eight items', () => {
    expect(navItems).toHaveLength(8);
  });

  it('hides the admin group from an agent', () => {
    const items = visibleNavItems('agent');
    expect(items).toHaveLength(6);
    expect(items.map((i) => i.to)).not.toContain('/sla-rules');
    expect(items.map((i) => i.to)).not.toContain('/users');
  });

  it('hides the admin group from a team lead', () => {
    const items = visibleNavItems('team_lead');
    expect(items).toHaveLength(6);
    expect(items.map((i) => i.to)).not.toContain('/sla-rules');
    expect(items.map((i) => i.to)).not.toContain('/users');
  });

  it('shows all eight items to an administrator', () => {
    const items = visibleNavItems('administrator');
    expect(items).toHaveLength(8);
    expect(items.map((i) => i.to)).toContain('/sla-rules');
    expect(items.map((i) => i.to)).toContain('/users');
  });
});
