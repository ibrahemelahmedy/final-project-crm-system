/**
 * Series colours for Recharts as `var(--…)` tokens from index.css, so both
 * light and dark themes work from the existing token set with no second
 * palette. Kept in its own module so ChartFrame.tsx exports only a component.
 */
export const chartColors = {
  created: 'var(--chart-series-1, #4F46E5)',
  resolved: 'var(--chart-series-2, #059669)',
  axis: 'var(--text-muted, #64748B)',
  grid: 'var(--border-card, #E2E8F0)',
  bar: 'var(--chart-series-1, #4F46E5)',
};
