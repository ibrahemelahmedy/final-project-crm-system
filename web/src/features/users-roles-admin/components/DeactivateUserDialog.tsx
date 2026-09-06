import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Modal } from '../../../components/ui/Modal';
import { useT } from '../../../i18n';
import type { AdminUser } from '../model/adminUser';
import { useDeactivateUser } from '../hooks/useUserMutations';

/**
 * The destructive confirmation from docs/design/references/5.Modals/.
 *
 * Two things the design and brief.md both require and that a generic
 * ConfirmDialog cannot express here:
 *
 *  - the title NAMES the specific user, never "this user";
 *  - the body states that their active sessions end IMMEDIATELY, because that
 *    is the actual consequence — all their tokens are revoked in the same
 *    transaction, so they are signed out mid-session rather than at next
 *    login.
 *
 * Focus lands on Cancel, not Confirm — a destructive default that catches a
 * stray Enter is a footgun (same rule as ConfirmDialog).
 */
export const DeactivateUserDialog: React.FC<{
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onDeactivated?: (user: AdminUser) => void;
}> = ({ open, user, onClose, onDeactivated }) => {
  const { t } = useT('users');
  const cancelRef = useRef<HTMLButtonElement>(null);
  // The error is tagged with the user it belongs to rather than cleared by an
  // effect on `open` — a stale message must never appear over a DIFFERENT
  // user's confirmation, and deriving that during render beats a setState in
  // an effect that triggers a second pass.
  const [error, setError] = useState<{ forUserId: number; message: string } | null>(null);
  const deactivate = useDeactivateUser();

  useEffect(() => {
    if (!open) return;
    // Runs after Modal's own "focus first" effect on the same open
    // transition; queue this one a tick later so it wins.
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!user) return null;

  const visibleError = error?.forUserId === user.id ? error.message : null;
  const fail = (message: string) => setError({ forUserId: user.id, message });

  const confirm = async () => {
    setError(null);
    try {
      const updated = await deactivate.mutateAsync(user.id);
      onDeactivated?.(updated);
      onClose();
    } catch (err) {
      // The self-deactivation and last-Administrator rules both arrive as a
      // 422. Surfacing the server's own message keeps the two reasons
      // distinguishable instead of collapsing them into "failed".
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const payload = err.response.data ?? {};
        const firstFieldError = Object.values((payload.errors ?? {}) as Record<string, string[]>)[0]?.[0];
        fail(firstFieldError ?? payload.message ?? t('deactivateDialog.cannotDeactivate'));
        return;
      }
      fail(t('deactivateDialog.genericError'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="deactivate-user-title"
      title={t('deactivateDialog.title', { name: user.name })}
      width={420}
    >
      <p className="modal-confirm-body">
        {t('deactivateDialog.bodyBeforeStrong', { name: user.name })}{' '}
        <strong>{t('deactivateDialog.bodyStrong')}</strong> {t('deactivateDialog.bodyAfterStrong')}
      </p>
      <p className="modal-confirm-body">{t('deactivateDialog.bodyFooter')}</p>

      {visibleError && (
        <p className="form-error" role="alert">
          {visibleError}
        </p>
      )}

      <div className="modal-footer modal-footer-end">
        <button type="button" ref={cancelRef} className="dt-btn dt-btn-outline fv" onClick={onClose}>
          {t('deactivateDialog.cancel')}
        </button>
        <button
          type="button"
          className="dt-btn dt-btn-danger fv"
          disabled={deactivate.isPending}
          onClick={confirm}
        >
          {deactivate.isPending ? t('deactivateDialog.working') : t('deactivateDialog.confirm')}
        </button>
      </div>
    </Modal>
  );
};
