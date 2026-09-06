import { useT } from '../../../i18n';
import type { IntegrationStatus } from '../model/types';

/**
 * Three variants. Each renders the translated status TEXT plus a dot —
 * never colour alone (brief.md "Color is never the only signal for state").
 */
export function StatusPill({ status }: { status: IntegrationStatus }) {
  const { t } = useT('integrations');

  return (
    <span className={`intg-pill intg-pill-${status}`}>
      <span className="intg-pill-dot" aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  );
}
