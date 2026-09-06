/**
 * Story 20 (WIS-20), Decision 8. The artboards' own printed contrast
 * numbers are WRONG — #0E7490 is labelled "Passes WCAG AA … (6.29:1) …
 * (6.23:1)" but computes to 5.35:1 on white and 3.13:1 on this app's dark
 * card background, i.e. it actually FAILS AA on dark. Compute, never
 * transcribe.
 */

function srgbToLinear(channel: number): number {
  const c = channel / 255;

  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance, 0..1. */
export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG 2.1 contrast ratio, always in [1, 21]. Symmetric in its arguments. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);

  return (lighter + 0.05) / (darker + 0.05);
}

/** The two backgrounds the app actually paints behind brand-coloured text. */
export const LIGHT_BG = '#FFFFFF'; // --bg-card, web/src/index.css light block
export const DARK_BG = '#1C1D24'; // --bg-card, web/src/index.css dark block

const AA_MINIMUM = 4.5;

export type ContrastVerdict = {
  onLight: number;
  onDark: number;
  passes: boolean;
};

/**
 * Compares on the UNROUNDED ratio — a 4.497 that displays as 4.50 must
 * still fail. Round only for display, never for the pass/fail decision.
 */
export function evaluate(hex: string): ContrastVerdict {
  const onLight = contrastRatio(hex, LIGHT_BG);
  const onDark = contrastRatio(hex, DARK_BG);

  return {
    onLight,
    onDark,
    passes: onLight >= AA_MINIMUM && onDark >= AA_MINIMUM,
  };
}
