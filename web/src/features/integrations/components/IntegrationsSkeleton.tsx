/**
 * Five card-shaped blocks at the real card height, so the grid does not jump
 * when the data lands. The shimmer is disabled under prefers-reduced-motion
 * by the shared `.tq-skeleton` rule (same one Story 06's SlaRulesSkeleton
 * reuses).
 */
export function IntegrationsSkeleton() {
  return (
    <div className="intg-grid" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="intg-skeleton tq-skeleton" />
      ))}
    </div>
  );
}
