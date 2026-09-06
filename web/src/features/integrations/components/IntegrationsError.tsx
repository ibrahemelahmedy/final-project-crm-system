import { useT } from '../../../i18n';

type Props = { onRetry: () => void };

/**
 * No page-level Error artboard exists in the design export (the list fetch
 * CAN fail) — this copies web/src/features/sla-rules/components/
 * SlaRulesError.tsx's pattern, per the story plan's "Design gaps to close".
 * No stack trace, no API URL — an error state is for the person reading it.
 */
export function IntegrationsError({ onRetry }: Props) {
  const { t } = useT('integrations');

  return (
    <div className="intg-state" role="alert">
      <h2 className="intg-state-title">{t('error.loadTitle')}</h2>
      <p className="intg-state-body">{t('error.loadBody')}</p>
      <button type="button" className="dt-btn dt-btn-primary" onClick={onRetry}>
        {t('error.retry')}
      </button>
    </div>
  );
}
