import { describe, it, expect } from 'vitest';
import { formatDuration, splitDuration, toMinutes } from './formatDuration';

describe('formatDuration', () => {
  it('renders the four seeded tiers exactly as the artboard reads', () => {
    expect(formatDuration(15)).toBe('15 minutes');
    expect(formatDuration(60)).toBe('1 hour');
    expect(formatDuration(240)).toBe('4 hours');
    expect(formatDuration(1440)).toBe('1 day');
    // The deliberate deviation: "5 business days" on the artboard ships as
    // "5 days", because the clock counts wall-clock minutes.
    expect(formatDuration(7200)).toBe('5 days');
  });

  it('uses the largest whole unit only', () => {
    // Not "1 hour 30 minutes" — the fact column is one line at 16px/700.
    expect(formatDuration(90)).toBe('90 minutes');
    expect(formatDuration(480)).toBe('8 hours');
  });

  it('handles singular and plural', () => {
    expect(formatDuration(1)).toBe('1 minute');
    expect(formatDuration(2)).toBe('2 minutes');
    expect(formatDuration(2880)).toBe('2 days');
  });
});

describe('splitDuration / toMinutes', () => {
  it('round-trips through the largest whole unit', () => {
    for (const minutes of [15, 60, 90, 240, 1440, 7200]) {
      const { value, unit } = splitDuration(minutes);
      expect(toMinutes(value, unit)).toBe(minutes);
    }
  });

  it('opens 240 as 4 hours, so the form matches the card', () => {
    expect(splitDuration(240)).toEqual({ value: 4, unit: 'hours' });
  });
});
