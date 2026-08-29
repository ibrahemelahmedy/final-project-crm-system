import { api } from '../../../lib/api';
import type { ReportSummary } from '../model/report';

// Goes through the shared Axios instance in web/src/lib/api.ts. Do not create
// a second client.
export async function fetchReportSummary(from: string, to: string): Promise<ReportSummary> {
  const { data } = await api.get('/reports/summary', { params: { from, to } });
  return data;
}
