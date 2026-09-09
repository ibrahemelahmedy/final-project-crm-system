import { useT } from '../../../i18n';
import type { IntegrationStatus, SyncRunStatus } from '../model/types';

/**
 * Three connection variants plus, since Story 25 (WIS-24), the four sync-run
 * statuses — one pill component, not two, per the story plan. Each renders
 * the translated status TEXT plus a dot — never colour alone (brief.md
 * "Color is never the only signal for state").
 */
export function StatusPill({ status }: { status: IntegrationStatus | SyncRunStatus }) {
  const { t } = useT('integrations');
  const key = status === 'success' || status === 'partial' || status === 'failed' || status === 'running'
    ? `sync.status.${status}`
    : `status.${status}`;

  return (
    <span className={`intg-pill intg-pill-${status}`}>
      <span className="intg-pill-dot" aria-hidden="true" />
      {t(key)}
    </span>
  );
}
