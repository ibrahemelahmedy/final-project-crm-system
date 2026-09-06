export type IntegrationTypeValue = 'erp' | 'email' | 'sms' | 'whatsapp' | 'api_webhook';
export type IntegrationStatus = 'not_connected' | 'connected' | 'error';

/**
 * Mirrors IntegrationResource exactly. There is no `secret` field, by
 * design — see Decision 4 in the story plan.
 *
 * The list of types is NOT declared as a local array here — it comes from
 * the API response, exactly as Story 14 requires for channels. A sixth type
 * added to the PHP enum appears with no TypeScript change.
 */
export type Integration = {
  type: IntegrationTypeValue;
  label_key: string;
  status: IntegrationStatus;
  endpoint_url: string | null;
  secret_last_four: string | null;
  last_checked_at: string | null;
  last_check_failed_at: string | null;
  last_error_key: string | null;
};

/**
 * IntegrationResource sends `label_key` AND `last_error_key` as
 * fully-qualified dotted keys (`integrations.type.erp.label`,
 * `integrations.error.unreachable`), matching Story 14's
 * ChannelOverviewController convention. Every t() call in this feature is
 * namespace-pinned via useT('integrations') though, so the leading namespace
 * segment must be stripped before either is passed to t() — otherwise
 * i18next looks for a nested "integrations" key INSIDE the integrations
 * namespace, which does not exist, and silently falls back to a humanised
 * key.
 */
export function unscopeKey(key: string): string {
  return key.replace(/^integrations\./, '');
}
