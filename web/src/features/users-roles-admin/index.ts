// The ONLY public surface of this feature. Nothing outside imports deeper.
export { UsersPage } from './pages/UsersPage';
export { AuditLogPage } from './pages/AuditLogPage';
export { SystemSettingsPage } from './pages/SystemSettingsPage';
export type { AdminUser, AuditLogEntry, SystemSetting, UserRole } from './model/adminUser';
export { adminKeys } from './api/queryKeys';
