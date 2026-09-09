import { z } from 'zod';
import { SYNC_FIELDS } from './types';

/**
 * Story 25 (WIS-24). Mirrors SaveIntegrationSyncRequest, following
 * createIntegrationSchema's `t` factory shape so messages are translated.
 */
export function createSyncConfigSchema(t: (key: string) => string) {
  return z
    .object({
      inboundEnabled: z.boolean(),
      inboundUrl: z.string(),
      externalIdPath: z.string(),
      outboundEnabled: z.boolean(),
      outboundUrl: z.string(),
    })
    .superRefine((val, ctx) => {
      if (val.inboundEnabled) {
        if (!val.inboundUrl.startsWith('https://')) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('error.scheme'), path: ['inboundUrl'] });
        }
        if (val.externalIdPath.trim() === '') {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('sync.fieldMap.externalIdRequired'), path: ['externalIdPath'] });
        }
      }
      if (val.outboundEnabled && !val.outboundUrl.startsWith('https://')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('error.scheme'), path: ['outboundUrl'] });
      }
    });
}

/** The closed key set a submitted field map may use — mirrors SyncFieldMap::FIELDS + external_id. */
export const ALLOWED_MAP_KEYS = ['external_id', ...SYNC_FIELDS] as const;
