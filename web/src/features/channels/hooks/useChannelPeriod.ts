import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_CHANNEL_PERIOD, isChannelPeriod, type ChannelPeriod } from '../model/channel';

/**
 * The selected period lives in the URL (`?period=30d`), per the shared
 * frontend contract that filter state is a URL search param — a refresh or a
 * shared link preserves it. An unrecognised value (`?period=365d`) is clamped
 * back to `30d` on read, so the page never issues a request it knows is a 422.
 */
export function useChannelPeriod(): {
  period: ChannelPeriod;
  setPeriod: (next: ChannelPeriod) => void;
} {
  const [params, setParams] = useSearchParams();

  const period = useMemo<ChannelPeriod>(() => {
    const raw = params.get('period');
    return isChannelPeriod(raw) ? raw : DEFAULT_CHANNEL_PERIOD;
  }, [params]);

  const setPeriod = useCallback(
    (next: ChannelPeriod) => {
      setParams(
        (prev) => {
          const search = new URLSearchParams(prev);
          search.set('period', next);
          return search;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  return { period, setPeriod };
}
