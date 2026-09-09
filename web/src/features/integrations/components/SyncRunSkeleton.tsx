/** Story 25 (WIS-24). Reuses IntegrationsSkeleton's bar treatment. */
export function SyncRunSkeleton() {
  return (
    <div aria-hidden="true" className="intg-run-list">
      {[0, 1, 2].map((i) => (
        <div key={i} className="intg-run-skeleton tq-skeleton" />
      ))}
    </div>
  );
}
