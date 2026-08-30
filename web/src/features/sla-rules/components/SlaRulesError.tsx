import { useT } from '../../../i18n';

type Props = { onRetry: () => void };

/**
 * No stack trace and no API URL in the copy — an error state is for the
 * person reading it, not for the developer.
 */
export function SlaRulesError({ onRetry }: Props) {
  const { t } = useT('sla');

  return (
    <div className="slar-state" role="alert">
      <h2 className="slar-state-title">{t('error.title')}</h2>
      <p className="slar-state-body">{t('error.body')}</p>
      <button type="button" className="slar-btn slar-btn-primary" onClick={onRetry}>
        {t('error.retry')}
      </button>
    </div>
  );
}
