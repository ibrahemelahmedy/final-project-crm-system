import { useMemo, useState } from 'react';
import { useT } from '../../../i18n';
import { useSaveSyncConfig } from '../hooks/useSaveSyncConfig';
import { useRunSyncNow } from '../hooks/useRunSyncNow';
import { createSyncConfigSchema } from '../model/syncConfigSchema';
import { FieldMapEditor } from './FieldMapEditor';
import type { ConflictRule, Integration, IntegrationEventValue } from '../model/types';

type Props = { integration: Integration };

const OUTBOUND_EVENTS: IntegrationEventValue[] = ['ticket.created', 'ticket.resolved', 'csat.submitted'];

/**
 * Story 25 (WIS-24), Task 50. The Sync tab body: inbound section, outbound
 * section, and a footer with Save + Run now.
 */
export function SyncSettingsPanel({ integration }: Props) {
  const { t } = useT('integrations');
  const schema = useMemo(() => createSyncConfigSchema(t), [t]);

  const sync = integration.sync;
  const [inboundEnabled, setInboundEnabled] = useState(sync.inbound_enabled);
  const [inboundUrl, setInboundUrl] = useState(sync.inbound_url ?? '');
  const [fieldMap, setFieldMap] = useState<Record<string, string>>(sync.inbound_field_map);
  const [conflictRules, setConflictRules] = useState<Record<string, ConflictRule>>(sync.conflict_rules);
  const [outboundEnabled, setOutboundEnabled] = useState(sync.outbound_enabled);
  const [outboundUrl, setOutboundUrl] = useState(sync.outbound_url ?? '');
  const [outboundEvents, setOutboundEvents] = useState<IntegrationEventValue[]>(sync.outbound_events);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<{ created: number; updated: number; skipped: number; failed: number } | null>(null);

  const save = useSaveSyncConfig();
  const runNow = useRunSyncNow();

  const toggleEvent = (event: IntegrationEventValue) => {
    setOutboundEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  };

  const validate = () => {
    const parsed = schema.safeParse({
      inboundEnabled,
      inboundUrl,
      externalIdPath: fieldMap.external_id ?? '',
      outboundEnabled,
      outboundUrl,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return false;
    }
    setErrors({});
    return true;
  };

  const onSave = async () => {
    if (!validate()) return;

    await save.mutateAsync({
      type: integration.type,
      body: {
        inbound_enabled: inboundEnabled,
        inbound_url: inboundUrl || null,
        inbound_field_map: fieldMap,
        conflict_rules: conflictRules,
        outbound_enabled: outboundEnabled,
        outbound_url: outboundUrl || null,
        outbound_events: outboundEvents,
      },
    });
  };

  const onRunNow = async () => {
    const run = await runNow.mutateAsync(integration.type);
    setRunResult({
      created: run.records_created,
      updated: run.records_updated,
      skipped: run.records_skipped,
      failed: run.records_failed,
    });
  };

  return (
    <div className="intg-sync-panel">
      <section className="intg-sync-section">
        <div className="intg-sync-section-head">
          <h4 className="intg-sync-section-title">{t('sync.inbound.title')}</h4>
          <label className="intg-toggle">
            <input
              type="checkbox"
              checked={inboundEnabled}
              onChange={(e) => setInboundEnabled(e.target.checked)}
            />
            {t('sync.inbound.enable')}
          </label>
        </div>

        <div className="intg-field">
          <label className="intg-field-label" htmlFor="intg-inbound-url">
            {t('sync.inbound.url')}
          </label>
          <input
            id="intg-inbound-url"
            type="text"
            className="intg-input"
            value={inboundUrl}
            disabled={!inboundEnabled}
            placeholder={t('sync.inbound.urlPlaceholder')}
            onChange={(e) => setInboundUrl(e.target.value)}
          />
          {errors.inboundUrl && <p className="intg-field-error">{errors.inboundUrl}</p>}
        </div>

        <FieldMapEditor
          fieldMap={fieldMap}
          conflictRules={conflictRules}
          onChangeFieldMap={setFieldMap}
          onChangeConflictRules={setConflictRules}
          disabled={!inboundEnabled}
        />
        {errors.externalIdPath && <p className="intg-field-error">{errors.externalIdPath}</p>}
      </section>

      <section className="intg-sync-section">
        <div className="intg-sync-section-head">
          <h4 className="intg-sync-section-title">{t('sync.outbound.title')}</h4>
          <label className="intg-toggle">
            <input
              type="checkbox"
              checked={outboundEnabled}
              onChange={(e) => setOutboundEnabled(e.target.checked)}
            />
            {t('sync.outbound.enable')}
          </label>
        </div>

        <div className="intg-field">
          <label className="intg-field-label" htmlFor="intg-outbound-url">
            {t('sync.outbound.url')}
          </label>
          <input
            id="intg-outbound-url"
            type="text"
            className="intg-input"
            value={outboundUrl}
            disabled={!outboundEnabled}
            placeholder={t('sync.outbound.urlPlaceholder')}
            onChange={(e) => setOutboundUrl(e.target.value)}
          />
          {errors.outboundUrl && <p className="intg-field-error">{errors.outboundUrl}</p>}
        </div>

        <fieldset className="intg-outbound-events" disabled={!outboundEnabled}>
          <legend>{t('sync.outbound.events')}</legend>
          {OUTBOUND_EVENTS.map((event) => (
            <label key={event} className="intg-toggle">
              <input
                type="checkbox"
                checked={outboundEvents.includes(event)}
                onChange={() => toggleEvent(event)}
              />
              {t(`sync.event.${event}`)}
            </label>
          ))}
        </fieldset>
      </section>

      {runResult && (
        <p className="intg-test-banner intg-test-banner-ok" role="status">
          {t('sync.ranNow', runResult)}
        </p>
      )}

      <div className="modal-footer intg-modal-footer">
        <button
          type="button"
          className="dt-btn dt-btn-outline"
          disabled={!sync.inbound_enabled || runNow.isPending}
          onClick={onRunNow}
        >
          {runNow.isPending ? t('sync.runningNow') : t('sync.runNow')}
        </button>
        <span className="intg-modal-footer-spacer" />
        <button type="button" className="dt-btn dt-btn-primary" disabled={save.isPending} onClick={onSave}>
          {t('form.save')}
        </button>
      </div>
    </div>
  );
}
