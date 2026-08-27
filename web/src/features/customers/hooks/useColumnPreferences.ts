import { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from '../../../components/data-table/types';

type ColumnPrefs = { order: string[]; hidden: string[] };

const storageKey = (userId: number) => `wisal-customers-columns:${userId}`;

function readPrefs(userId: number): ColumnPrefs | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) return null;
    return parsed as ColumnPrefs;
  } catch {
    return null;
  }
}

function writePrefs(userId: number, prefs: ColumnPrefs) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch {
    // A hardened browser (private mode, storage disabled) throws on write.
    // Swallow it — the in-memory state still updates; the preference just
    // doesn't survive a reload.
  }
}

// Reconciles stored ids against the live column list: an id no longer
// defined is dropped, and a column added by a later release that is absent
// from storage is appended in its declared position.
function reconcile<T>(columns: ColumnDef<T>[], prefs: ColumnPrefs | null): ColumnPrefs {
  const liveIds = columns.map((c) => c.id);
  if (!prefs) {
    return { order: liveIds, hidden: [] };
  }
  const knownOrder = prefs.order.filter((id) => liveIds.includes(id));
  const missing = liveIds.filter((id) => !knownOrder.includes(id));
  const lockedIds = new Set(columns.filter((c) => c.locked).map((c) => c.id));
  return {
    order: [...knownOrder, ...missing],
    hidden: prefs.hidden.filter((id) => liveIds.includes(id) && !lockedIds.has(id)),
  };
}

export function useColumnPreferences<T>(userId: number, columns: ColumnDef<T>[]) {
  // Read once on mount inside useState's initialiser, wrapped in try/catch
  // — the same defensive shape as UiPreferencesContext's getInitialTheme.
  const [prefs, setPrefs] = useState<ColumnPrefs>(() => reconcile(columns, readPrefs(userId)));

  const orderedColumns = useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]));
    return prefs.order.map((id) => byId.get(id)).filter((c): c is ColumnDef<T> => Boolean(c));
  }, [columns, prefs.order]);

  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => !prefs.hidden.includes(c.id)),
    [orderedColumns, prefs.hidden]
  );

  // Write ONLY inside the toggle/reorder callback below — never in a
  // mount effect, or a plain visit would no longer leave localStorage
  // empty.
  const toggleHidden = useCallback(
    (id: string) => {
      setPrefs((prev) => {
        const col = columns.find((c) => c.id === id);
        if (col?.locked) return prev;
        const next = prev.hidden.includes(id)
          ? { ...prev, hidden: prev.hidden.filter((x) => x !== id) }
          : { ...prev, hidden: [...prev.hidden, id] };
        writePrefs(userId, next);
        return next;
      });
    },
    [columns, userId]
  );

  const moveColumn = useCallback(
    (id: string, direction: 'up' | 'down') => {
      setPrefs((prev) => {
        const index = prev.order.indexOf(id);
        if (index === -1) return prev;
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= prev.order.length) return prev;
        const nextOrder = [...prev.order];
        [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
        const next = { ...prev, order: nextOrder };
        writePrefs(userId, next);
        return next;
      });
    },
    [userId]
  );

  return { columns: visibleColumns, allColumns: orderedColumns, hidden: prefs.hidden, toggleHidden, moveColumn };
}
