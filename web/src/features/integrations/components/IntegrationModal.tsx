import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT } from '../../../i18n';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SecretField } from './SecretField';
import { SyncSettingsPanel } from './SyncSettingsPanel';
import { SyncRunHistory } from './SyncRunHistory';
import { DeadLetterPanel } from './DeadLetterPanel';
import { useSaveIntegration } from '../hooks/useSaveIntegration';
import { useTestIntegration } from '../hooks/useTestIntegration';
import { useDisconnectIntegration } from '../hooks/useDisconnectIntegration';
import { createIntegrationSchema } from '../model/integrationSchema';
import { unscopeKey, type Integration } from '../model/types';

type Props = { integration: Integration; onClose: () => void };

type Phase = 'idle' | 'testing' | 'test_failed' | 'test_passed' | 'saving';

type TabKey = 'connection' | 'sync' | 'history';

const TABS: TabKey[] = ['connection', 'sync', 'history'];

/**
 * Story 25 (WIS-24), Task 54. A tab strip above the body: Connection · Sync ·
 * History. The active tab lives in the URL alongside `?configure={type}`, as
 * `?configure=erp&tab=sync` — IntegrationsPage.tsx's "modal state lives in
 * the URL" rule. Default `connection`.
 */
function TabStrip({
  active,
  onSelect,
  disabledTabs,
  disabledTitle,
}: {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
  disabledTabs: TabKey[];
  disabledTitle: string;
}) {
  const { t } = useT('integrations');

  const onKeyDown = (e: React.KeyboardEvent) => {
    const enabled = TABS.filter((tab) => !disabledTabs.includes(tab));
    const idx = enabled.indexOf(active);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const next = enabled[(idx + dir + enabled.length) % enabled.length];
      onSelect(next);
    }
  };

  return (
    <div className="intg-tabstrip" role="tablist" onKeyDown={onKeyDown}>
      {TABS.map((tab) => {
        const disabled = disabledTabs.includes(tab);
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`intg-tab-${tab}`}
            aria-selected={active === tab}
            aria-controls={`intg-tabpanel-${tab}`}
            tabIndex={active === tab ? 0 : -1}
            className={`intg-tab${active === tab ? ' intg-tab-active' : ''}`}
            disabled={disabled}
            title={disabled ? disabledTitle : undefined}
            onClick={() => !disabled && onSelect(tab)}
          >
            {t(`sync.tab.${tab}`)}
          </button>
        );
      })}
    </div>
  );
}

function ConnectionTab({
  integration,
  onClose,
}: {
  integration: Integration;
  onClose: () => void;
}) {
  const { t } = useT('integrations');
  const requireSecret = integration.status === 'not_connected';
  const schema = useMemo(() => createIntegrationSchema(t, requireSecret), [t, requireSecret]);

  const [endpointUrl, setEndpointUrl] = useState(integration.endpoint_url ?? '');
  const [secret, setSecret] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [testErrorKey, setTestErrorKey] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const save = useSaveIntegration();
  const test = useTestIntegration();
  const disconnect = useDisconnectIntegration();

  const canManageDisconnect = integration.status === 'connected' || integration.status === 'error';

  const validate = (): boolean => {
    const parsed = schema.safeParse({ endpoint_url: endpointUrl, secret });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] = issue.message;
      }
      setErrors(next);
      return false;
    }
    setErrors({});
    return true;
  };

  const runTest = async () => {
    if (!validate()) return;
    setPhase('testing');
    setTestErrorKey(null);

    const result = await test.mutateAsync({
      type: integration.type,
      body: { endpoint_url: endpointUrl, secret: secret || undefined },
    });

    if (result.ok) {
      setPhase('test_passed');
    } else {
      setPhase('test_failed');
      setTestErrorKey(result.error_key);
    }
  };

  const onSave = async () => {
    if (!validate()) return;
    setPhase('saving');

    await save.mutateAsync({
      type: integration.type,
      body: { endpoint_url: endpointUrl, secret: secret || undefined },
    });

    onClose();
  };

  const onDisconnect = async () => {
    await disconnect.mutateAsync(integration.type);
    onClose();
  };

  const testing = phase === 'testing';
  const saving = phase === 'saving' || save.isPending;

  return (
    <>
      <div className="intg-field">
        <label className="intg-field-label" htmlFor="intg-endpoint-input">
          {t('form.endpointUrl')}
        </label>
        <input
          id="intg-endpoint-input"
          type="text"
          className="intg-input"
          value={endpointUrl}
          onChange={(e) => setEndpointUrl(e.target.value)}
          placeholder={t('form.endpointPlaceholder')}
        />
        {errors.endpoint_url && <p className="intg-field-error">{errors.endpoint_url}</p>}
      </div>

      <SecretField
        value={secret}
        onChange={setSecret}
        secretLastFour={integration.secret_last_four}
        error={errors.secret}
      />

      <p className="intg-test-help">{t('form.testHelp')}</p>

      {phase === 'test_failed' && (
        <p className="intg-test-banner intg-test-banner-error" role="alert">
          {t(unscopeKey(testErrorKey ?? 'integrations.error.unreachable'))}
        </p>
      )}
      {phase === 'test_passed' && <p className="intg-test-banner intg-test-banner-ok">{t('form.testPassed')}</p>}

      <div className="modal-footer intg-modal-footer">
        {canManageDisconnect && (
          <button
            type="button"
            className="dt-btn dt-btn-danger-outline intg-modal-footer-disconnect"
            onClick={() => setConfirmDisconnect(true)}
          >
            {t('action.disconnect')}
          </button>
        )}
        <span className="intg-modal-footer-spacer" />
        <button type="button" className="dt-btn dt-btn-outline" disabled={testing || saving} onClick={runTest}>
          {testing ? t('form.testing') : t('form.test')}
        </button>
        <button type="button" className="dt-btn dt-btn-outline" onClick={onClose}>
          {t('form.cancel')}
        </button>
        <button type="button" className="dt-btn dt-btn-primary" disabled={testing || saving} onClick={onSave}>
          {t('form.save')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        title={t('disconnect.title', { type: t(unscopeKey(integration.label_key)) })}
        body={t('disconnect.body', { type: t(unscopeKey(integration.label_key)) })}
        confirmLabel={t('disconnect.confirm')}
        tone="danger"
        isPending={disconnect.isPending}
        onConfirm={onDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </>
  );
}

/**
 * Wraps the shared Modal (focus trap, Escape, backdrop, scroll lock come
 * free). Story 25 (WIS-24) adds the Sync and History tabs beside the
 * original Connection form, which keeps its exact previous behaviour.
 */
export function IntegrationModal({ integration, onClose }: Props) {
  const { t } = useT('integrations');
  const [params, setParams] = useSearchParams();

  const notConnected = integration.status === 'not_connected';
  const requestedTab = (params.get('tab') as TabKey | null) ?? 'connection';
  const activeTab: TabKey = notConnected && requestedTab !== 'connection' ? 'connection' : requestedTab;

  const setTab = (tab: TabKey) => {
    const next = new URLSearchParams(params);
    if (tab === 'connection') {
      next.delete('tab');
    } else {
      next.set('tab', tab);
    }
    setParams(next);
  };

  const typeLabel = t(unscopeKey(integration.label_key));
  const requireSecret = integration.status === 'not_connected';
  const titleKey = requireSecret ? 'form.connectTitle' : 'form.configureTitle';
  const width = activeTab === 'connection' ? 480 : 640;

  return (
    <Modal open onClose={onClose} titleId="intg-modal-title" title={t(titleKey, { type: typeLabel })} width={width}>
      <TabStrip
        active={activeTab}
        onSelect={setTab}
        disabledTabs={notConnected ? ['sync', 'history'] : []}
        disabledTitle={t('sync.connectFirst')}
      />

      <div role="tabpanel" id={`intg-tabpanel-${activeTab}`} aria-labelledby={`intg-tab-${activeTab}`}>
        {activeTab === 'connection' && <ConnectionTab integration={integration} onClose={onClose} />}
        {activeTab === 'sync' && !notConnected && (
          <>
            <SyncSettingsPanel integration={integration} />
            {integration.sync.dead_letter_count > 0 && <DeadLetterPanel integration={integration} />}
          </>
        )}
        {activeTab === 'history' && !notConnected && <SyncRunHistory type={integration.type} />}
      </div>
    </Modal>
  );
}
