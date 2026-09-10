import { useState } from 'react';
import { useT } from '../../../i18n';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { api } from '../../../lib/api';
import { ChannelSecretField } from './ChannelSecretField';
import { useSaveChannelConnection } from '../hooks/useSaveChannelConnection';
import { useTestChannelConnection } from '../hooks/useTestChannelConnection';
import { useDisconnectChannel } from '../hooks/useDisconnectChannel';
import { PROVIDER_FOR_CHANNEL, unscopeErrorKey, type ChannelConnection } from '../model/channel';

type Props = { connection: ChannelConnection; onClose: () => void };

type Phase = 'idle' | 'saving' | 'testing' | 'test_ok' | 'test_failed';

/**
 * Story 26 (WIS-22), Task 66. A focus-trapped dialog per
 * integrations/components/IntegrationModal.tsx, built on the shared Modal
 * (focus trap, Escape, backdrop, scroll lock all come free from it).
 *
 * The field set is keyed on `connection.channel`, never on a user-chosen
 * provider — App\Enums\ChannelProvider::channel() is a fixed 1:1 mapping, so
 * there is nothing to pick from (PROVIDER_FOR_CHANNEL mirrors that fixed
 * pairing; see model/channel.ts).
 */
export function ChannelConnectModal({ connection, onClose }: Props) {
  const { t } = useT('channels');
  const channel = connection.channel;
  const provider = connection.provider ?? PROVIDER_FOR_CHANNEL[channel] ?? channel;
  const isConnected = connection.status !== 'not_connected';

  const [secret, setSecret] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState(connection.config.phone_number_id ?? '');
  const [fromNumber, setFromNumber] = useState(connection.config.from_number ?? '');
  const [accountSid, setAccountSid] = useState(connection.config.account_sid ?? '');
  const [inboundAddress, setInboundAddress] = useState(connection.config.inbound_address ?? '');
  const [allowedOrigins, setAllowedOrigins] = useState((connection.config.allowed_origins ?? []).join('\n'));
  const [siteKey, setSiteKey] = useState(connection.config.site_key ?? '');

  const [phase, setPhase] = useState<Phase>('idle');
  const [testErrorKey, setTestErrorKey] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const save = useSaveChannelConnection();
  const test = useTestChannelConnection();
  const disconnect = useDisconnectChannel();

  const hasSecret = channel === 'email' || channel === 'whatsapp' || channel === 'sms';
  const hasVerifyToken = channel === 'whatsapp';
  const webhookUrl =
    channel === 'chat' ? null : `${(api.defaults.baseURL ?? '').replace(/\/$/, '')}/webhooks/channels/${provider}`;

  const buildConfig = (): Record<string, unknown> => {
    switch (channel) {
      case 'email':
        return { inbound_address: inboundAddress };
      case 'whatsapp':
        return { phone_number_id: phoneNumberId };
      case 'sms':
        return { account_sid: accountSid, from_number: fromNumber };
      case 'chat':
        return {
          allowed_origins: allowedOrigins
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
          site_key: siteKey,
        };
      default:
        return {};
    }
  };

  const onSave = async () => {
    setPhase('saving');
    await save.mutateAsync({
      channel,
      body: {
        provider,
        // Absent key = keep the stored value (the three-state contract
        // SaveChannelConnectionRequest expects). An untouched field must
        // OMIT the key entirely, not send it as `undefined` — a spread of
        // `{ key: undefined }` still leaves `key` as an own property.
        ...(hasSecret && secret !== '' ? { secret } : {}),
        ...(hasVerifyToken && verifyToken !== '' ? { verify_token: verifyToken } : {}),
        config: buildConfig(),
      },
    });
    onClose();
  };

  const runTest = async () => {
    setPhase('testing');
    setTestErrorKey(null);
    const result = await test.mutateAsync(channel);
    if (result.ok) {
      setPhase('test_ok');
    } else {
      setPhase('test_failed');
      setTestErrorKey(result.error_key);
    }
  };

  const onDisconnect = async () => {
    await disconnect.mutateAsync(channel);
    onClose();
  };

  const testing = phase === 'testing' || test.isPending;
  const saving = phase === 'saving' || save.isPending;

  return (
    <Modal open onClose={onClose} titleId="ch-connect-modal-title" title={t('connect.title', { channel: t(`presentation.${channel}.label`) })}>
      {webhookUrl && (
        <div className="ch-field">
          <label className="ch-field-label" htmlFor="ch-webhook-url">
            {t('connect.webhookUrl')}
          </label>
          <input id="ch-webhook-url" className="ch-input" type="text" readOnly value={webhookUrl} onFocus={(e) => e.target.select()} />
        </div>
      )}

      {hasSecret && (
        <ChannelSecretField
          id="ch-secret-input"
          label={t('connect.secret')}
          value={secret}
          onChange={setSecret}
          lastFour={connection.secret_last_four}
        />
      )}

      {hasVerifyToken && (
        <ChannelSecretField
          id="ch-verify-token-input"
          label={t('connect.verifyToken')}
          value={verifyToken}
          onChange={setVerifyToken}
          lastFour={null}
        />
      )}

      {channel === 'whatsapp' && (
        <div className="ch-field">
          <label className="ch-field-label" htmlFor="ch-phone-number-id">
            {t('connect.phoneNumberId')}
          </label>
          <input
            id="ch-phone-number-id"
            className="ch-input"
            type="text"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
          />
        </div>
      )}

      {channel === 'sms' && (
        <>
          <div className="ch-field">
            <label className="ch-field-label" htmlFor="ch-account-sid">
              {t('connect.accountSid')}
            </label>
            <input
              id="ch-account-sid"
              className="ch-input"
              type="text"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
            />
          </div>
          <div className="ch-field">
            <label className="ch-field-label" htmlFor="ch-from-number">
              {t('connect.fromNumber')}
            </label>
            <input
              id="ch-from-number"
              className="ch-input"
              type="text"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
            />
          </div>
        </>
      )}

      {channel === 'email' && (
        <div className="ch-field">
          <label className="ch-field-label" htmlFor="ch-inbound-address">
            {t('connect.inboundAddress')}
          </label>
          <input
            id="ch-inbound-address"
            className="ch-input"
            type="text"
            value={inboundAddress}
            onChange={(e) => setInboundAddress(e.target.value)}
          />
        </div>
      )}

      {channel === 'chat' && (
        <>
          <div className="ch-field">
            <label className="ch-field-label" htmlFor="ch-allowed-origins">
              {t('connect.allowedOrigins')}
            </label>
            <textarea
              id="ch-allowed-origins"
              className="ch-input ch-textarea"
              rows={3}
              value={allowedOrigins}
              onChange={(e) => setAllowedOrigins(e.target.value)}
            />
          </div>
          <div className="ch-field">
            <label className="ch-field-label" htmlFor="ch-site-key">
              {t('connect.siteKey')}
            </label>
            <input id="ch-site-key" className="ch-input" type="text" value={siteKey} onChange={(e) => setSiteKey(e.target.value)} />
          </div>
        </>
      )}

      {phase === 'test_failed' && (
        <p className="ch-test-banner ch-test-banner-error" role="alert">
          {t(unscopeErrorKey(testErrorKey ?? 'channels.error.not_configured'))}
        </p>
      )}
      {phase === 'test_ok' && <p className="ch-test-banner ch-test-banner-ok">{t('connect.testOk')}</p>}

      <div className="modal-footer ch-modal-footer">
        {isConnected && (
          <button
            type="button"
            className="dt-btn dt-btn-danger-outline ch-modal-footer-disconnect"
            onClick={() => setConfirmDisconnect(true)}
          >
            {t('connect.disconnect')}
          </button>
        )}
        <span className="ch-modal-footer-spacer" />
        {isConnected && (
          <button type="button" className="dt-btn dt-btn-outline" disabled={testing || saving} onClick={runTest}>
            {testing ? t('connect.testing') : t('connect.test')}
          </button>
        )}
        <button type="button" className="dt-btn dt-btn-primary" disabled={testing || saving} onClick={onSave}>
          {t('connect.save')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        title={t('connect.confirmDisconnect', { channel: t(`presentation.${channel}.label`) })}
        body={t('connect.confirmDisconnect', { channel: t(`presentation.${channel}.label`) })}
        confirmLabel={t('connect.disconnect')}
        tone="danger"
        isPending={disconnect.isPending}
        onConfirm={onDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </Modal>
  );
}
