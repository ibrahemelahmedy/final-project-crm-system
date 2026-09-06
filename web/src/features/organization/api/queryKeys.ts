/**
 * Rooted at ['organization'], deliberately NOT nested under ticketKeys — see
 * web/src/features/sla-rules/api/queryKeys.ts for the same reasoning.
 * Nothing in this feature changes a ticket, so ticketKeys.all is never
 * invalidated from here.
 */
export const organizationKeys = {
  all: ['organization'] as const,
  branches: () => [...organizationKeys.all, 'branches'] as const,
  departments: () => [...organizationKeys.all, 'departments'] as const,
  branding: () => [...organizationKeys.all, 'branding'] as const,
};
