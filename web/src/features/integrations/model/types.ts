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
  /** Story 25 (WIS-24). Mirrors IntegrationResource's `sync` object exactly. */
  sync: IntegrationSync;
};

export type ConflictRule = 'remote_wins' | 'wisal_wins';
export type IntegrationEventValue = 'ticket.created' | 'ticket.resolved' | 'csat.submitted';
export type SyncDirection = 'inbound' | 'outbound';
export type SyncRunStatus = 'running' | 'success' | 'partial' | 'failed';
export type SyncRunTrigger = 'scheduled' | 'manual';

export type IntegrationSync = {
  inbound_enabled: boolean;
  inbound_url: string | null;
  inbound_field_map: Record<string, string>;
  conflict_rules: Record<string, ConflictRule>;
  last_inbound_sync_at: string | null;
  outbound_enabled: boolean;
  outbound_url: string | null;
  outbound_events: IntegrationEventValue[];
  last_outbound_sync_at: string | null;
  dead_letter_count: number;
};

export type SyncRunError = { external_id: string | null; field: string | null; reason_key: string; detail: string | null };

export type SyncRun = {
  id: number;
  direction: SyncDirection;
  trigger: SyncRunTrigger;
  status: SyncRunStatus;
  records_read: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  records_failed: number;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  error_key: string | null;
  errors: SyncRunError[];
};

export type OutboxMessage = {
  id: number;
  event: IntegrationEventValue;
  event_id: string;
  status: 'pending' | 'delivered' | 'dead';
  attempts: number;
  last_status: number | null;
  last_error_key: string | null;
  next_attempt_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  created_at: string;
};

/** Laravel's AnonymousResourceCollection envelope — same shape tickets/customers use. */
export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

/**
 * The closed set of mappable Wisal fields. Mirrors SyncFieldMap::FIELDS —
 * the PHP constant is the authority; change both together.
 */
export const SYNC_FIELDS = ['name', 'email', 'phone', 'company', 'tier'] as const;

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
