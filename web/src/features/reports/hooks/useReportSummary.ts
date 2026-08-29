import { useQuery } from '@tanstack/react-query';
import { reportKeys } from '../api/queryKeys';
import { fetchReportSummary } from '../api/reportsApi';

/**
 * ONE query for the entire Reports page. Because there is a single query keyed
 * by the range, a range change refetches everything at once and no widget can
 * end up showing a stale, different range from its neighbours.
 */
export function useReportSummary(from: string, to: string) {
  return useQuery({
    queryKey: reportKeys.summary(from, to),
    queryFn: () => fetchReportSummary(from, to),
  });
}
