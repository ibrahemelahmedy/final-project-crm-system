/**
 * Rooted at ['sla-rules'], deliberately NOT nested under ticketKeys.all.
 *
 * Story 04 nests TICKET queries under that root so a ticket mutation
 * invalidates them. Rules are a different resource with a different lifetime;
 * nesting them would make every ticket edit refetch the rules list.
 *
 * Saving a rule invalidates BOTH roots — a rule change alters the ON BREACH
 * copy, and future tickets get new targets.
 */
export const slaRuleKeys = {
  all: ['sla-rules'] as const,
  list: () => [...slaRuleKeys.all, 'list'] as const,
};
