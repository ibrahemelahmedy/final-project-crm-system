import { api } from '../../../lib/api';
import type {
  AdminUser,
  AuditLogEntry,
  AuditLogFacets,
  Paginated,
  SystemSetting,
  UserFacets,
} from '../model/adminUser';
import type { AuditLogParams } from '../hooks/useAuditLogParams';
import type { UserListParams } from '../hooks/useUserListParams';
import type { InviteUserFormValues } from '../model/userSchema';

// Every HTTP call for this feature lives here, importing the one shared Axios
// instance — never `axios` directly.

function userListToQuery(params: Partial<UserListParams>) {
  const query: Record<string, unknown> = {};
  if (params.q) query.q = params.q;
  if (params.role?.length) query.role = params.role;
  if (params.department?.length) query.department = params.department;
  if (params.status) query.status = params.status;
  if (params.sort) query.sort = params.sort;
  if (params.dir) query.dir = params.dir;
  if (params.page) query.page = params.page;
  if (params.per_page) query.per_page = params.per_page;
  return query;
}

function auditListToQuery(params: Partial<AuditLogParams>) {
  const query: Record<string, unknown> = {};
  if (params.actor_id) query.actor_id = params.actor_id;
  if (params.event?.length) query.event = params.event;
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  if (params.q) query.q = params.q;
  if (params.page) query.page = params.page;
  if (params.per_page) query.per_page = params.per_page;
  return query;
}

// A blank department is sent as null, not '' — `users.department` is nullable
// and the DEPARTMENT column renders "—" for null. An empty string would be a
// third state nothing handles.
function toUserPayload(values: InviteUserFormValues) {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    role: values.role,
    department: values.department.trim() === '' ? null : values.department.trim(),
  };
}

export async function listUsers(params: UserListParams): Promise<Paginated<AdminUser>> {
  const { data } = await api.get('/admin/users', { params: userListToQuery(params) });
  return data;
}

export async function getUserFacets(): Promise<UserFacets> {
  const { data } = await api.get('/admin/users/facets');
  return data;
}

export async function inviteUser(values: InviteUserFormValues): Promise<AdminUser> {
  const { data } = await api.post('/admin/users', toUserPayload(values));
  return data.data;
}

export async function updateUser(id: number, values: InviteUserFormValues): Promise<AdminUser> {
  const { data } = await api.patch(`/admin/users/${id}`, toUserPayload(values));
  return data.data;
}

// Deactivation, not deletion. There is no deleteUser here because the API
// exposes no such route — historical ticket and audit rows stay attributed.
export async function deactivateUser(id: number): Promise<AdminUser> {
  const { data } = await api.post(`/admin/users/${id}/deactivate`);
  return data.data;
}

export async function activateUser(id: number): Promise<AdminUser> {
  const { data } = await api.post(`/admin/users/${id}/activate`);
  return data.data;
}

export async function listAuditLogs(params: AuditLogParams): Promise<Paginated<AuditLogEntry>> {
  const { data } = await api.get('/admin/audit-logs', { params: auditListToQuery(params) });
  return data;
}

export async function getAuditLogFacets(): Promise<AuditLogFacets> {
  const { data } = await api.get('/admin/audit-logs/facets');
  return data;
}

export async function getSettings(): Promise<SystemSetting[]> {
  const { data } = await api.get('/admin/settings');
  return data.data;
}

export async function updateSettings(
  values: Record<string, number>
): Promise<{ data: SystemSetting[]; changed: string[] }> {
  const { data } = await api.patch('/admin/settings', { settings: values });
  return data;
}
