import { useT } from '../../../i18n';
import { unscopeKey, type SyncRunError } from '../model/types';

export function SyncRunErrors({ errors }: { errors: SyncRunError[] }) {
  const { t } = useT('integrations');

  if (errors.length === 0) return null;

  return (
    <ul className="intg-run-errors">
      {errors.map((error, i) => (
        <li key={i} className="intg-run-error-row">
          {error.external_id && <span className="intg-run-error-id">{error.external_id}</span>}
          <span>{t(unscopeKey(error.reason_key))}</span>
        </li>
      ))}
    </ul>
  );
}
