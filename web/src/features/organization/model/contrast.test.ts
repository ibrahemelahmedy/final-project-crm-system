import { describe, it, expect } from 'vitest';
import { contrastRatio, evaluate } from './contrast';

describe('contrastRatio', () => {
  it('yields 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('yields 1:1 for a color against itself', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('matches the published AA boundary for #767676 on white', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 1);
  });

  it('is symmetric in its arguments', () => {
    expect(contrastRatio('#0E7490', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#0E7490'), 10);
  });
});

describe('evaluate', () => {
  // Decision 8: the artboard prints #0E7490 as passing (6.29:1 / 6.23:1).
  // Pinned here so nobody "corrects" the helper to match those numbers.
  it('reports #0E7490 as FAILING AA on dark, despite the artboard labelling it passing', () => {
    const verdict = evaluate('#0E7490');

    expect(verdict.onLight).toBeCloseTo(5.35, 1);
    expect(verdict.onDark).toBeCloseTo(3.13, 1);
    expect(verdict.onDark).toBeLessThan(4.5);
    expect(verdict.passes).toBe(false);
  });

  // A real, checked mathematical fact of these two specific reference
  // colors (#FFFFFF and #1C1D24, the app's dark --bg-card): AA(white)
  // requires luminance <= ~0.183, AA(#1C1D24) requires luminance >= ~0.231
  // — two non-overlapping ranges. No single hex value can ever satisfy
  // both simultaneously, including pure black (which is the highest
  // possible white-contrast but the LOWEST possible dark-card contrast).
  // The live verdict therefore always warns; it never blocks Save.
  it('shows that even pure black — maximal contrast on white — still fails against the dark card', () => {
    const verdict = evaluate('#000000');

    expect(verdict.onLight).toBeCloseTo(21, 1);
    expect(verdict.onDark).toBeLessThan(4.5);
    expect(verdict.passes).toBe(false);
  });
});
