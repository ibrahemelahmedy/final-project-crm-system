import React, { useEffect, useRef } from 'react';
import { Modal } from './Modal';

// Port of WisalModals-LightLTR.dc.html lines 139-150. The title must name
// the specific record or the exact count (brief.md line 186). Focus lands
// on Cancel, not Confirm — a destructive default that catches a stray
// Enter is a footgun.
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'danger';
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, body, confirmLabel, tone, isPending, onConfirm, onCancel }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Runs after Modal's own "focus first" effect on the same open
      // transition; queue this one a tick later so it wins.
      const id = window.setTimeout(() => cancelRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onCancel} titleId="confirm-dialog-title" title={title} width={380}>
      <p className="modal-confirm-body">{body}</p>
      <div className="modal-footer modal-footer-end">
        <button type="button" ref={cancelRef} className="dt-btn dt-btn-outline fv" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={tone === 'danger' ? 'dt-btn dt-btn-danger fv' : 'dt-btn dt-btn-primary fv'}
          disabled={isPending}
          onClick={onConfirm}
        >
          {isPending ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};
