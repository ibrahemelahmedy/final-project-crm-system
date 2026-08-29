import React from 'react';
import type { AdminUser } from '../model/adminUser';
import { UserFormModal } from './UserFormModal';

export const EditUserModal: React.FC<{
  open: boolean;
  user: AdminUser;
  onClose: () => void;
  onSaved?: (user: AdminUser) => void;
}> = (props) => <UserFormModal {...props} />;
