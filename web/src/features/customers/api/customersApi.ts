import { api } from '../../../lib/api';
import type { CustomerListParams } from '../hooks/useCustomerListParams';
import type {
  Customer,
  CustomerAttachment,
  CustomerFacets,
  CustomerNote,
  CustomerTier,
  Paginated,
  Ticket,
} from '../model/customer';
import type { CustomerFormValues } from '../model/customerSchema';

// Every HTTP call for this feature lives here, importing the one shared
// Axios instance — never `axios` directly.

function listParamsToQuery(params: Partial<CustomerListParams>) {
  const query: Record<string, unknown> = {};
  if (params.q) query.q = params.q;
  if (params.company?.length) query.company = params.company;
  if (params.tier?.length) query.tier = params.tier;
  if (params.sort) query.sort = params.sort;
  if (params.dir) query.dir = params.dir;
  if (params.page) query.page = params.page;
  if (params.per_page) query.per_page = params.per_page;
  return query;
}

// Converts form values into the API payload: blank strings become null so
// they never collide with each other on the unique index, and never send
// phone_normalized — the server derives it.
function toPayload(values: CustomerFormValues) {
  return {
    name: values.name,
    email: values.email.trim() === '' ? null : values.email.trim(),
    phone: values.phone.trim() === '' ? null : values.phone.trim(),
    company: values.company.trim() === '' ? null : values.company.trim(),
    tier: values.tier,
  };
}

export async function listCustomers(params: CustomerListParams): Promise<Paginated<Customer>> {
  const { data } = await api.get('/customers', { params: listParamsToQuery(params) });
  return data;
}

export async function getFacets(params: Partial<CustomerListParams>): Promise<CustomerFacets> {
  const { data } = await api.get('/customers/facets', { params: listParamsToQuery(params) });
  return data;
}

export async function getCustomer(id: number): Promise<Customer> {
  const { data } = await api.get(`/customers/${id}`);
  return data.data;
}

export async function createCustomer(values: CustomerFormValues): Promise<Customer> {
  const { data } = await api.post('/customers', toPayload(values));
  return data.data;
}

export async function updateCustomer(id: number, values: CustomerFormValues): Promise<Customer> {
  const { data } = await api.patch(`/customers/${id}`, toPayload(values));
  return data.data;
}

export async function deleteCustomer(id: number): Promise<void> {
  await api.delete(`/customers/${id}`);
}

export type BulkPayload =
  | { action: 'delete'; ids: number[] }
  | { action: 'set_tier'; ids: number[]; tier: CustomerTier };

export async function bulkAction(payload: BulkPayload): Promise<{ action: string; affected: number }> {
  const { data } = await api.post('/customers/bulk', payload);
  return data;
}

export async function listCustomerTickets(id: number, page = 1): Promise<Paginated<Ticket>> {
  const { data } = await api.get(`/customers/${id}/tickets`, { params: { page } });
  return data;
}

export async function listNotes(id: number): Promise<Paginated<CustomerNote>> {
  const { data } = await api.get(`/customers/${id}/notes`);
  return data;
}

export async function createNote(id: number, body: string): Promise<CustomerNote> {
  const { data } = await api.post(`/customers/${id}/notes`, { body });
  return data.data;
}

export async function listAttachments(id: number): Promise<Paginated<CustomerAttachment>> {
  const { data } = await api.get(`/customers/${id}/attachments`);
  return data;
}

// FormData boundary is set by Axios itself — Content-Type is never set by
// hand here, or a boundary-less multipart body is the most common upload
// failure.
export async function uploadAttachment(id: number, file: File): Promise<CustomerAttachment> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/customers/${id}/attachments`, form);
  return data.data;
}

export async function deleteAttachment(id: number, attachmentId: number): Promise<void> {
  await api.delete(`/customers/${id}/attachments/${attachmentId}`);
}

// The download route requires the Bearer token, which a plain <a href>
// never sends (ADR-004: the token lives in memory, not a cookie). Fetch it
// as a blob through the shared Axios instance instead.
export async function downloadAttachmentBlob(downloadUrl: string): Promise<Blob> {
  const { data } = await api.get(downloadUrl, { responseType: 'blob' });
  return data;
}
