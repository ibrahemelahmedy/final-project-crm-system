import { z } from 'zod';

export function createBrandingSchema(t: (key: string) => string) {
  return z.object({
    primary_color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, { message: t('branding.error.invalidColor') }),
  });
}
