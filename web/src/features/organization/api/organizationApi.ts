import { api } from '../../../lib/api';
import type { Branch, Branding, Department } from '../model/types';

// The shared Axios instance from web/src/lib/api.ts. Every response is
// Laravel's `{ data: ... }` envelope; it is unwrapped here so no component
// knows about it.

export const fetchBranches = async (): Promise<Branch[]> =>
  (await api.get<{ data: Branch[] }>('/admin/branches')).data.data;

export type SaveBranchBody = {
  name: string;
  region: string | null;
  timezone: string;
  is_active: boolean;
};

export const createBranch = async (body: SaveBranchBody): Promise<Branch> =>
  (await api.post<{ data: Branch }>('/admin/branches', body)).data.data;

export const updateBranch = async (id: number, body: SaveBranchBody): Promise<Branch> =>
  (await api.patch<{ data: Branch }>(`/admin/branches/${id}`, body)).data.data;

export const fetchDepartments = async (): Promise<Department[]> =>
  (await api.get<{ data: Department[] }>('/admin/departments')).data.data;

export type SaveDepartmentBody = {
  branch_id: number;
  name: string;
  is_active: boolean;
};

export const createDepartment = async (body: SaveDepartmentBody): Promise<Department> =>
  (await api.post<{ data: Department }>('/admin/departments', body)).data.data;

export const updateDepartment = async (id: number, body: SaveDepartmentBody): Promise<Department> =>
  (await api.patch<{ data: Department }>(`/admin/departments/${id}`, body)).data.data;

export const fetchAdminBranding = async (): Promise<Branding> =>
  (await api.get<{ data: Branding }>('/admin/branding')).data.data;

export const fetchOrganizationBranding = async (): Promise<Branding> =>
  (await api.get<{ data: Branding }>('/organization/branding')).data.data;

export const saveBranding = async (primaryColor: string | null): Promise<Branding> =>
  (await api.patch<{ data: Branding }>('/admin/branding', { primary_color: primaryColor })).data.data;

export const uploadBrandingLogo = async (file: File): Promise<Branding> => {
  const form = new FormData();
  form.append('logo', file);

  return (await api.post<{ data: Branding }>('/admin/branding/logo', form)).data.data;
};

export const removeBrandingLogo = async (): Promise<Branding> =>
  (await api.delete<{ data: Branding }>('/admin/branding/logo')).data.data;
