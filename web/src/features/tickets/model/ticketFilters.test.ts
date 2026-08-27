import { describe, it, expect } from 'vitest';
import { countActiveFacets, parseTicketFilters } from './ticketFilters';

describe('ticketFiltersSchema', () => {
  it('defaults every facet to empty and the page to 1', () => {
    const filters = parseTicketFilters({});

    expect(filters.status).toEqual([]);
    expect(filters.priority).toEqual([]);
    expect(filters.channel).toEqual([]);
    expect(filters.category).toEqual([]);
    expect(filters.assigned_to).toEqual([]);
    expect(filters.q).toBe('');
    expect(filters.page).toBe(1);
    expect(filters.per_page).toBe(25);
    expect(filters.sort).toBe('-created_at');
  });

  it('falls back to defaults on a malformed URL', () => {
    // `.parse` would throw here and there is no error boundary above the page.
    expect(() => parseTicketFilters({ priority: ['critical'], page: 'abc' })).not.toThrow();

    const filters = parseTicketFilters({ priority: ['critical'], page: 'abc' });
    expect(filters.priority).toEqual([]);
    expect(filters.page).toBe(1);
  });

  it('keeps the valid members of a partly malformed facet', () => {
    const filters = parseTicketFilters({ priority: ['high', 'critical', 'urgent'] });
    expect(filters.priority).toEqual(['high', 'urgent']);
  });

  it('keeps the unassigned sentinel in the assigned_to array', () => {
    const filters = parseTicketFilters({ assigned_to: ['3', 'unassigned'] });
    expect(filters.assigned_to).toEqual(['3', 'unassigned']);
  });
});

describe('countActiveFacets', () => {
  it('counts a facet and a search term but not sort or paging', () => {
    expect(countActiveFacets(parseTicketFilters({}))).toBe(0);
    expect(countActiveFacets(parseTicketFilters({ page: '3', sort: 'id' }))).toBe(0);
    expect(countActiveFacets(parseTicketFilters({ priority: ['high'] }))).toBe(1);
    expect(countActiveFacets(parseTicketFilters({ priority: ['high'], q: 'login' }))).toBe(2);
  });
});
