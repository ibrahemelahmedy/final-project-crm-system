import { useT } from '../../../i18n';

/**
 * Story 25 (WIS-24), Task 52. This feature deliberately has no Empty
 * component for the connection list (IntegrationsPage.tsx explains why), but
 * a run history genuinely can be empty — nothing has run yet.
 */
export function SyncEmpty() {
  const { t } = useT('integrations');

  return (
    <div className="intg-state">
      <h4 className="intg-state-title">{t('sync.empty.title')}</h4>
      <p className="intg-state-body">{t('sync.empty.body')}</p>
    </div>
  );
}
