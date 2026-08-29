import { csatPublicClient } from './csatPublicClient';
import { api } from '../../../lib/api';
import type { CsatSurvey, CsatSubmission, TicketCsat } from '../model/csat';

// The signed-link query params (`expires`, `signature`) live in the page URL
// and must be forwarded verbatim to the API — the signature covers the API
// URL, so dropping or re-encoding them invalidates it.
function signedQuery(): string {
  return typeof window !== 'undefined' ? window.location.search : '';
}

export async function fetchCsatSurvey(uuid: string): Promise<CsatSurvey> {
  const { data } = await csatPublicClient.get<CsatSurvey>(`/csat/${uuid}${signedQuery()}`);
  return data;
}

export async function submitCsatResponse(
  uuid: string,
  body: CsatSubmission
): Promise<CsatSurvey> {
  const { data } = await csatPublicClient.post<CsatSurvey>(`/csat/${uuid}${signedQuery()}`, body);
  return data;
}

// Agent-side read goes through the SHARED authenticated client — this one is
// an internal, session-gated endpoint.
export async function fetchTicketCsat(ticketId: number): Promise<TicketCsat> {
  const { data } = await api.get<TicketCsat>(`/tickets/${ticketId}/csat`);
  return data;
}
