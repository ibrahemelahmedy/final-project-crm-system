import { useState } from 'react';
import { useT, formatRelative } from '../../../i18n';
import { StatusPill } from './StatusPill';
import { SyncRunErrors } from './SyncRunErrors';
import { unscopeKey, type SyncRun } from '../model/types';

/**
 * Story 25 (WIS-24), Task 52. Direction icon, status pill, relative start
 * time, duration, and the five counters — rendered with DIRECTION-SPECIFIC
 * labels (Decision 9). Expandable into SyncRunErrors when the run has
 * failures or a run-level error_key.
 */
export function SyncRunRow({ run }: { run: SyncRun }) {
  const { t } = useT('integrations');
  const [open, setOpen] = useState(false);
  const expandable = run.records_failed > 0 || run.error_key !== null;

  return (
    <li className="intg-run-row">
      <div className="intg-run-row-main">
        <span className="intg-run-direction" aria-hidden="true">
          {run.direction === 'inbound' ? '↓' : '↑'}
        </span>
        <span className="intg-run-direction-label">{t(`sync.direction.${run.direction}`)}</span>
        <StatusPill status={run.status} />
        <span className="intg-run-time">{run.started_at ? formatRelative(run.started_at) : '—'}</span>
        <span className="intg-run-trigger">{t(`sync.trigger.${run.trigger}`)}</span>
        <span className="intg-run-duration">
          {run.duration_seconds === null ? t('sync.running') : t('sync.durationSeconds', { count: run.duration_seconds })}
        </span>
      </div>

      <dl className="intg-run-counters">
        <div>
          <dt>{t(`sync.counter.${run.direction}.read`)}</dt>
          <dd>{run.records_read}</dd>
        </div>
        <div>
          <dt>{t(`sync.counter.${run.direction}.created`)}</dt>
          <dd>{run.records_created}</dd>
        </div>
        <div>
          <dt>{t(`sync.counter.${run.direction}.updated`)}</dt>
          <dd>{run.records_updated}</dd>
        </div>
        <div>
          <dt>{t(`sync.counter.${run.direction}.skipped`)}</dt>
          <dd>{run.records_skipped}</dd>
        </div>
        <div>
          <dt>{t(`sync.counter.${run.direction}.failed`)}</dt>
          <dd>{run.records_failed}</dd>
        </div>
      </dl>

      {run.error_key && <p className="intg-run-error-key">{t(unscopeKey(run.error_key))}</p>}

      {expandable && (
        <>
          <button type="button" className="dt-btn dt-btn-outline intg-run-toggle" onClick={() => setOpen((v) => !v)}>
            {open ? t('sync.hideErrors') : t('sync.showErrors', { count: run.records_failed })}
          </button>
          {open && <SyncRunErrors errors={run.errors} />}
        </>
      )}
    </li>
  );
}
