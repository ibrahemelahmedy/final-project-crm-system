import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Two behaviours the design implies and the export does not contain:
 *  1. scroll to the bottom on first load and on every appended own message
 *  2. hold the reading position when older messages are prepended
 */
export function useThreadScrollAnchor(deps: {
  /** total message count — grows on append (bottom) and on prepend (top) */
  count: number;
  /** flips true while a "load earlier" fetch is in flight */
  prepending: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef<number | null>(null);
  const prevCountRef = useRef(0);
  const didInitialScrollRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, []);

  // Record scrollHeight the moment a prepend begins, before the new rows land.
  useEffect(() => {
    if (deps.prepending && ref.current) {
      prevHeightRef.current = ref.current.scrollHeight;
    }
  }, [deps.prepending]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const grew = deps.count - prevCountRef.current;
    prevCountRef.current = deps.count;

    if (!didInitialScrollRef.current && deps.count > 0) {
      didInitialScrollRef.current = true;
      el.scrollTop = el.scrollHeight;
      return;
    }

    if (prevHeightRef.current !== null && grew > 0) {
      el.scrollTop += el.scrollHeight - prevHeightRef.current;
      prevHeightRef.current = null;
    }
  }, [deps.count]);

  return { ref, scrollToBottom };
}
