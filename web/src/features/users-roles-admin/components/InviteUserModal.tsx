import React from 'react';
import type { AdminUser } from '../model/adminUser';
import { UserFormModal } from './UserFormModal';

// The plan names InviteUserModal and EditUserModal as two components; they
// differ only in whether a `user` is bound, so both are thin names over the
// one form (the same call Story 03's CustomerFormModal makes). Two full copies
// would be two places to fix the role select.
export const InviteUserModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSaved?: (user: AdminUser) => void;
}> = (props) => <UserFormModal {...props} />;
