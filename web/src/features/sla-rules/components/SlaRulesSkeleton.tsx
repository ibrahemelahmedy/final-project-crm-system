/**
 * Four card-shaped blocks at the real card height, so the list does not jump
 * when the data lands. The shimmer is disabled under prefers-reduced-motion
 * by the shared `.tq-skeleton` rule.
 */
export function SlaRulesSkeleton() {
  return (
    <div className="slar-list" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="slar-skeleton tq-skeleton" />
      ))}
    </div>
  );
}
