import { portalClient } from './portalClient';
import type {
  PortalArticle,
  PortalCustomer,
  PortalPaginated,
  PortalTicket,
  PortalTicketCategory,
  PortalTicketDetail,
} from '../model/portal';

export type AccessRequestResponse = {
  sent: boolean;
  masked_identifier: string;
  resend_after_seconds: number;
};

export function requestAccessCode(identifier: string) {
  return portalClient
    .post<AccessRequestResponse>('/portal/access/request', { identifier })
    .then((r) => r.data);
}

export type VerifyResponse = {
  token: string;
  expires_at: string;
  customer: PortalCustomer;
};

export function verifyAccessCode(identifier: string, code: string) {
  return portalClient
    .post<VerifyResponse>('/portal/access/verify', { identifier, code })
    .then((r) => r.data);
}

export function fetchPortalMe() {
  return portalClient.get<PortalCustomer>('/portal/me').then((r) => r.data);
}

export function portalLogout() {
  return portalClient.post('/portal/logout');
}

export function fetchPortalRequests(scope: 'open' | 'past', page = 1) {
  return portalClient
    .get<PortalPaginated<PortalTicket>>('/portal/requests', { params: { scope, page } })
    .then((r) => r.data);
}

export function fetchPortalRequest(ticketId: number | string) {
  return portalClient.get<PortalTicketDetail>(`/portal/requests/${ticketId}`).then((r) => r.data);
}

export type NewPortalRequestInput = {
  subject: string;
  description: string;
  category: PortalTicketCategory;
};

export function createPortalRequest(input: NewPortalRequestInput) {
  return portalClient.post<PortalTicket>('/portal/requests', input).then((r) => r.data);
}

export function replyToPortalRequest(ticketId: number | string, body: string) {
  return portalClient
    .post<PortalTicket>(`/portal/requests/${ticketId}/messages`, { body })
    .then((r) => r.data);
}

export function fetchPortalFaq(params: { q?: string; category?: string[] } = {}) {
  return portalClient.get<PortalPaginated<PortalArticle>>('/portal/faq', { params }).then((r) => r.data);
}

export function fetchPortalArticle(slug: string) {
  // PortalFaqController::show() returns a bare JsonResource, so Laravel's
  // default `data` envelope is present here — unlike the ticket endpoints,
  // which resolve() their resources and answer unwrapped.
  return portalClient
    .get<{ data: PortalArticle }>(`/portal/faq/${slug}`)
    .then((r) => r.data.data);
}
