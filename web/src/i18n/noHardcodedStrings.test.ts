import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs script, no type declarations
import { runCheck, scanFileByPath, webRoot } from '../../scripts/check-no-literals.mjs';

/**
 * Story 15 (WIS-11) — THE enforcement deliverable. If this test is deleted or
 * skipped, the first acceptance criterion is not met: no hard-coded English
 * literal survives in a component, enforced by a rule that fails
 * `npx vitest run` — not by convention.
 */
describe('no hard-coded strings check', () => {
  it('reports zero violations across the enforced roots', () => {
    const { files, violations } = runCheck() as {
      files: string[];
      violations: { file: string; line: number; kind: string; text: string }[];
    };
    const offenders = violations.map((v) => `${v.file}:${v.line} ${v.kind} "${v.text}"`);
    expect(offenders).toEqual([]);
    expect(files.length).toBeGreaterThan(0);
  });

  it('fails on a component containing a bare JSX literal and a bare attribute literal', () => {
    const fixture = `${webRoot}/src/i18n/__fixtures__/BareLiteral.fixture.tsx`;
    const violations = scanFileByPath(fixture) as { kind: string }[];
    const kinds = violations.map((v) => v.kind);
    expect(kinds).toContain('jsx-text');
    expect(kinds).toContain('attr:title');
  });
});
