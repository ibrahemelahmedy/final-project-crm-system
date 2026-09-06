import { z } from 'zod';

export function createDepartmentSchema(t: (key: string) => string) {
  return z.object({
    // A plain z.number() would let 0 through from an empty <select> — the
    // no-branch-yet state disables the select entirely, but the schema
    // still needs to reject the value it would otherwise submit.
    branch_id: z.number().int().positive({ message: t('departments.error.branchRequired') }),
    name: z.string().trim().min(1, { message: t('departments.error.nameRequired') }).max(120),
    is_active: z.boolean(),
  });
}

export type DepartmentFormValues = z.infer<ReturnType<typeof createDepartmentSchema>>;
