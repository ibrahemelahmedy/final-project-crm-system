import { useT } from '../../../i18n';

/** Two variants. Renders the translated status TEXT, never colour alone. */
export function StatusPill({ isActive }: { isActive: boolean }) {
  const { t } = useT('organization');

  return (
    <span className={isActive ? 'org-status-pill org-status-pill-active' : 'org-status-pill org-status-pill-inactive'}>
      {isActive ? t('status.active') : t('status.inactive')}
    </span>
  );
}
