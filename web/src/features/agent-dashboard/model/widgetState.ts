export type WidgetState = 'loading' | 'error' | 'empty' | 'ready';

/** Maps a react-query result to the widget's four explicit states. */
export function widgetState(
  q: { isPending: boolean; isError: boolean; data: unknown },
  isEmpty: (data: unknown) => boolean
): WidgetState {
  if (q.isPending) return 'loading';
  if (q.isError) return 'error';
  if (isEmpty(q.data)) return 'empty';
  return 'ready';
}

/** Convenience empty-check for widgets backed by a list endpoint. */
export const emptyList = (d: unknown): boolean => Array.isArray(d) && d.length === 0;
