import { useT } from '../../../i18n';
import { SYNC_FIELDS, type ConflictRule } from '../model/types';

type Props = {
  fieldMap: Record<string, string>;
  conflictRules: Record<string, ConflictRule>;
  onChangeFieldMap: (next: Record<string, string>) => void;
  onChangeConflictRules: (next: Record<string, ConflictRule>) => void;
  disabled?: boolean;
};

/**
 * Story 25 (WIS-24), Task 51. One row per SYNC_FIELDS entry plus a pinned
 * first row for external_id, which has no conflict select — it is the key,
 * not a value (Decision 5).
 */
export function FieldMapEditor({ fieldMap, conflictRules, onChangeFieldMap, onChangeConflictRules, disabled }: Props) {
  const { t } = useT('integrations');

  const setPath = (field: string, path: string) => {
    const next = { ...fieldMap };
    if (path.trim() === '') {
      delete next[field];
    } else {
      next[field] = path;
    }
    onChangeFieldMap(next);
  };

  const setRule = (field: string, rule: ConflictRule) => {
    onChangeConflictRules({ ...conflictRules, [field]: rule });
  };

  return (
    <table className="intg-fieldmap" data-testid="field-map-editor">
      <thead>
        <tr>
          <th>{t('sync.fieldMap.wisalField')}</th>
          <th>{t('sync.fieldMap.remotePath')}</th>
          <th>{t('sync.fieldMap.conflictRule')}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="intg-fieldmap-field">{t('sync.fieldMap.field.external_id')}</td>
          <td>
            <input
              type="text"
              className="intg-input"
              aria-label={t('sync.fieldMap.remotePathFor', { field: t('sync.fieldMap.field.external_id') })}
              value={fieldMap.external_id ?? ''}
              disabled={disabled}
              placeholder={t('sync.fieldMap.pathPlaceholder')}
              onChange={(e) => setPath('external_id', e.target.value)}
            />
          </td>
          <td aria-hidden="true" />
        </tr>

        {SYNC_FIELDS.map((field) => {
          const path = fieldMap[field] ?? '';
          const hasPath = path.trim() !== '';

          return (
            <tr key={field}>
              <td className="intg-fieldmap-field">{t(`sync.fieldMap.field.${field}`)}</td>
              <td>
                <input
                  type="text"
                  className="intg-input"
                  aria-label={t('sync.fieldMap.remotePathFor', { field: t(`sync.fieldMap.field.${field}`) })}
                  value={path}
                  disabled={disabled}
                  placeholder={t('sync.fieldMap.pathPlaceholder')}
                  onChange={(e) => setPath(field, e.target.value)}
                />
              </td>
              <td>
                <select
                  className="intg-input"
                  aria-label={t('sync.fieldMap.conflictRuleFor', { field: t(`sync.fieldMap.field.${field}`) })}
                  value={conflictRules[field] ?? 'remote_wins'}
                  disabled={disabled || !hasPath}
                  onChange={(e) => setRule(field, e.target.value as ConflictRule)}
                >
                  <option value="remote_wins">{t('sync.fieldMap.rule.remote_wins')}</option>
                  <option value="wisal_wins">{t('sync.fieldMap.rule.wisal_wins')}</option>
                </select>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
