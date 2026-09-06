import { useMemo, useState } from 'react';
import { useT } from '../../../i18n';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SecretField } from './SecretField';
import { useSaveIntegration } from '../hooks/useSaveIntegration';
import { useTestIntegration } from '../hooks/useTestIntegration';
import { useDisconnectIntegration } from '../hooks/useDisconnectIntegration';
import { createIntegrationSchema } from '../model/integrationSchema';
import { unscopeKey, type Integration } from '../model/types';

type Props = { integration: Integration; onClose: () => void };

type Phase = 'idle' | 'testing' | 'test_failed' | 'test_passed' | 'saving';

/**
 * Wraps the shared Modal (focus trap, Escape, backdrop, scroll lock come
 * free). Footer, in DOM order: Disconnect (destructive, connected/errored
 * only) · spacer · Test connection · Cancel · Save — per the story plan's
 * "Design gaps to close" section (no Disconnect control exists in any
 * artboard).
 */
export function IntegrationModal({ integration, onClose }: Props) {
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
  const typeLabel = t(unscopeKey(integration.label_key));
  const titleKey = requireSecret ? 'form.connectTitle' : 'form.configureTitle';

  return (
    <>
      <Modal
        open
        onClose={onClose}
        titleId="intg-modal-title"
        title={t(titleKey, { type: typeLabel })}
        width={480}
      >
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
        {phase === 'test_passed' && (
          <p className="intg-test-banner intg-test-banner-ok">{t('form.testPassed')}</p>
        )}

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
      </Modal>

      <ConfirmDialog
        open={confirmDisconnect}
        title={t('disconnect.title', { type: typeLabel })}
        body={t('disconnect.body', { type: typeLabel })}
        confirmLabel={t('disconnect.confirm')}
        tone="danger"
        isPending={disconnect.isPending}
        onConfirm={onDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </>
  );
}
