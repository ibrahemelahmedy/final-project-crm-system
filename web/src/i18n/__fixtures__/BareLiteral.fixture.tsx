// Fixture for src/i18n/noHardcodedStrings.test.ts — a component with a bare
// JSX literal and a bare attribute literal. The check MUST flag both. Kept
// in __fixtures__ so the real scan (which skips that dir) never sees it.
export const BareLiteral = () => (
  <button title="Delete this ticket">This text is not translated</button>
);
