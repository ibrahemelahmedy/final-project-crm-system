import { z } from 'zod';
import { USER_ROLES } from './adminUser';

// The single source for BOTH the form types and the validation, per the
// story's frontend contract. There is no second copy of these rules in a
// component.

/**
 * Story 16 (WIS-17): `t` is required, not optional — an optional translator
 * with an English default is exactly the shape that kept untranslated
 * fallback copy alive in a "migrated" feature (see sla-rules/model/slaRuleSchema.ts).
 */
export function makeInviteUserSchema(t: (key: string) => string) {
  // z.enum over the three role values with no '' member — that is what makes a
  // role-less submit impossible at the type level as well as at runtime, and
  // why the role select renders no blank option.
  const roleField = z.enum(USER_ROLES as [string, ...string[]], {
    message: t('schema.roleRequired'),
  });

  return z.object({
    name: z.string().trim().min(1, t('schema.nameRequired')).max(255),
    email: z.string().trim().min(1, t('schema.emailRequired')).email(t('schema.emailInvalid')).max(255),
    role: roleField,
    department: z.string().max(255).or(z.literal('')),
  });
}

export type InviteUserFormValues = z.infer<ReturnType<typeof makeInviteUserSchema>>;
export type EditUserFormValues = InviteUserFormValues;
