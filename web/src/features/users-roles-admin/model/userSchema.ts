import { z } from 'zod';
import { USER_ROLES } from './adminUser';

// The single source for BOTH the form types and the validation, per the
// story's frontend contract. There is no second copy of these rules in a
// component.

// z.enum over the three role values with no '' member — that is what makes a
// role-less submit impossible at the type level as well as at runtime, and
// why the role select renders no blank option.
const roleField = z.enum(USER_ROLES as [string, ...string[]], {
  message: 'Select a role. Every user has exactly one.',
});

export const inviteUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address').max(255),
  role: roleField,
  department: z.string().max(255).or(z.literal('')),
});

export const editUserSchema = inviteUserSchema;

export type InviteUserFormValues = z.infer<typeof inviteUserSchema>;
export type EditUserFormValues = z.infer<typeof editUserSchema>;
