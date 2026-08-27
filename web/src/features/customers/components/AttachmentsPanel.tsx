import React, { useRef, useState } from 'react';
import axios from 'axios';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
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

function clientValidate(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return `That file type is not accepted. Allowed types: ${ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(', ')}.`;
  }
  if (file.size > MAX_CLIENT_MB * 1024 * 1024) {
    return `That file is too large. The limit is ${MAX_CLIENT_MB} MB.`;
  }
  return null;
}

export const AttachmentsPanel: React.FC<{ customerId: number; canDeleteAny: boolean; currentUserId: number }> = ({
  customerId,
  canDeleteAny,
  currentUserId,
}) => {
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
    const clientError = clientValidate(file);
    if (clientError) {
      setError(clientError);
      return;
    }
    try {
      await upload.mutateAsync(file);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const messages = err.response.data?.errors?.file;
        setError(messages?.[0] ?? err.response.data?.message ?? 'That file could not be uploaded.');
      } else {
        setError('That file could not be uploaded.');
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
    <section className="profile-panel" aria-label="Attachments">
      <h2>Attachments</h2>

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
        <span>Drag files here or click to browse</span>
        <input
          ref={inputRef}
          type="file"
          className="dropzone-input"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      {isLoading && <p className="dt-empty-body">Loading attachments…</p>}
      {isError && (
        <div>
          <p className="dt-empty-body">Something went wrong loading attachments.</p>
          <button type="button" className="dt-btn dt-btn-outline fv" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}
      {!isLoading && !isError && (data?.data.length ?? 0) === 0 && <p className="dt-empty-body">No attachments yet.</p>}

      <ul className="attachment-list">
        {data?.data.map((attachment) => {
          const canDelete = canDeleteAny || attachment.uploaded_by?.id === currentUserId;
          return (
            <li key={attachment.id} className="attachment-row">
              <span className="attachment-name">{attachment.original_name}</span>
              <span className="attachment-meta">
                {attachment.size_label} · {attachment.uploaded_by?.name ?? 'Unknown'}
              </span>
              <button type="button" className="dt-btn dt-btn-outline fv" onClick={() => download(attachment)}>
                Download
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="dt-btn dt-btn-danger-outline fv"
                  onClick={() => setPendingDelete(attachment)}
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {pendingDelete && (
        <ConfirmDialog
          open
          title={`Remove ${pendingDelete.original_name}?`}
          body="This attachment will be permanently removed from the customer record."
          confirmLabel="Remove"
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
