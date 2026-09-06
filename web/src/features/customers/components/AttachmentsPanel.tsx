import React, { useRef, useState } from 'react';
import axios from 'axios';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useT } from '../../../i18n';
import {
  useCustomerAttachments,
  useDeleteCustomerAttachment,
  useUploadCustomerAttachment,
} from '../hooks/useCustomerAttachments';
import { downloadAttachmentBlob } from '../api/customersApi';
import type { CustomerAttachment } from '../model/customer';

// Client-side limits are a courtesy — the server rule (config/attachments.php)
// stays authoritative and its 422 message is rendered verbatim.
const MAX_CLIENT_MB = 10;
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx'];

function clientValidate(file: File, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return t('attachments.typeNotAccepted', { types: ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(', ') });
  }
  if (file.size > MAX_CLIENT_MB * 1024 * 1024) {
    return t('attachments.tooLarge', { limit: MAX_CLIENT_MB });
  }
  return null;
}

export const AttachmentsPanel: React.FC<{ customerId: number; canDeleteAny: boolean; currentUserId: number }> = ({
  customerId,
  canDeleteAny,
  currentUserId,
}) => {
  const { t } = useT('customers');
  const { data, isLoading, isError, refetch } = useCustomerAttachments(customerId);
  const upload = useUploadCustomerAttachment(customerId);
  const remove = useDeleteCustomerAttachment(customerId);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomerAttachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    const clientError = clientValidate(file, t);
    if (clientError) {
      setError(clientError);
      return;
    }
    try {
      await upload.mutateAsync(file);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const messages = err.response.data?.errors?.file;
        setError(messages?.[0] ?? err.response.data?.message ?? t('attachments.uploadFailed'));
      } else {
        setError(t('attachments.uploadFailed'));
      }
    }
  };

  const download = async (attachment: CustomerAttachment) => {
    const blob = await downloadAttachmentBlob(attachment.download_url);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.original_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="profile-panel" aria-label={t('attachments.heading')}>
      <h2>{t('attachments.heading')}</h2>

      <label
        className="dropzone"
        data-dragover={dragOver}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0] ?? null);
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12 M7 10l5-5 5 5 M4 21h16" />
        </svg>
        <span>{t('attachments.dropzoneHint')}</span>
        <input
          ref={inputRef}
          type="file"
          className="dropzone-input"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      {isLoading && <p className="dt-empty-body">{t('attachments.loading')}</p>}
      {isError && (
        <div>
          <p className="dt-empty-body">{t('attachments.error')}</p>
          <button type="button" className="dt-btn dt-btn-outline fv" onClick={() => refetch()}>
            {t('attachments.tryAgain')}
          </button>
        </div>
      )}
      {!isLoading && !isError && (data?.data.length ?? 0) === 0 && <p className="dt-empty-body">{t('attachments.empty')}</p>}

      <ul className="attachment-list">
        {data?.data.map((attachment) => {
          const canDelete = canDeleteAny || attachment.uploaded_by?.id === currentUserId;
          return (
            <li key={attachment.id} className="attachment-row">
              <span className="attachment-name">{attachment.original_name}</span>
              <span className="attachment-meta">
                {attachment.size_label} · {attachment.uploaded_by?.name ?? t('attachments.unknownUploader')}
              </span>
              <button type="button" className="dt-btn dt-btn-outline fv" onClick={() => download(attachment)}>
                {t('attachments.download')}
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="dt-btn dt-btn-danger-outline fv"
                  onClick={() => setPendingDelete(attachment)}
                >
                  {t('attachments.remove')}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {pendingDelete && (
        <ConfirmDialog
          open
          title={t('attachments.removeConfirmTitle', { name: pendingDelete.original_name })}
          body={t('attachments.removeConfirmBody')}
          confirmLabel={t('attachments.remove')}
          tone="danger"
          isPending={remove.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await remove.mutateAsync(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
};
