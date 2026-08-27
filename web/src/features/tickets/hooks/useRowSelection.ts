import { useCallback, useMemo, useState } from 'react';
import type { TicketFilters } from '../model/ticketFilters';

/**
 * Selection is scoped to the current page and cleared on ANY filter or page
 * change. Without that, a user can bulk-close rows they can no longer see.
 *
 * The clearing effect keys on the SERIALISED filters, not on the rows array —
 * the rows array changes identity on every refetch and would clear the
 * selection during a harmless background refresh.
 */
export function useRowSelection(filters: TicketFilters) {
  const [selected, setSelected] = useState<number[]>([]);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  // Adjusting state during render rather than in an effect: React re-renders
  // immediately with the cleared selection instead of painting one frame with
  // a stale one, and there is no cascading-render round trip.
  const [seenKey, setSeenKey] = useState(filtersKey);
  if (seenKey !== filtersKey) {
    setSeenKey(filtersKey);
    setSelected([]);
  }

  const toggle = useCallback((id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const setAll = useCallback((ids: number[]) => {
    setSelected(ids);
  }, []);

  const clear = useCallback(() => {
    setSelected([]);
  }, []);

  return { selected, toggle, setAll, clear };
}
