import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_PRESET, matchPreset, presetRange } from '../model/report';

/**
 * The Reports date range lives in URL search params — the single source of
 * truth for the whole page. Deep-linking `/reports?from=…&to=…` reproduces the
 * exact page. Missing/invalid params fall back to the last 30 days.
 */
export function useReportRange() {
  const [params, setParams] = useSearchParams();

  const { from, to, preset } = useMemo(() => {
    const rawFrom = params.get('from');
    const rawTo = params.get('to');
    const valid = rawFrom && rawTo && isIsoDate(rawFrom) && isIsoDate(rawTo) && rawFrom <= rawTo;
    const resolved = valid
      ? { from: rawFrom as string, to: rawTo as string }
      : presetRange(DEFAULT_PRESET);
    return { ...resolved, preset: matchPreset(resolved.from, resolved.to) };
  }, [params]);

  const setPreset = useCallback(
    (days: number) => {
      const r = presetRange(days);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('from', r.from);
          next.set('to', r.to);
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const setRange = useCallback(
    (nextFrom: string, nextTo: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('from', nextFrom);
          next.set('to', nextTo);
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  return { from, to, preset, setPreset, setRange };
}

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
