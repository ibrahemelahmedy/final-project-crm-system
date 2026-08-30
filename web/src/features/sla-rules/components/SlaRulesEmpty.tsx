import { useT } from '../../../i18n';

type Props = { onAdd: () => void };

/**
 * Reachable in practice: a database migrated without DatabaseSeeder. The body
 * names the CONSEQUENCE of having no rules rather than restating the title.
 */
export function SlaRulesEmpty({ onAdd }: Props) {
  const { t } = useT('sla');

  return (
    <div className="slar-state">
      <h2 className="slar-state-title">{t('empty.title')}</h2>
      <p className="slar-state-body">{t('empty.body')}</p>
      <button type="button" className="slar-btn slar-btn-primary" onClick={onAdd}>
        {t('addRule')}
      </button>
    </div>
  );
}
