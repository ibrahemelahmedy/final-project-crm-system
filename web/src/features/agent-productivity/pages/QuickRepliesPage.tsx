import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuickReplies } from '../hooks/useQuickReplies';
import {
  useArchiveQuickReply,
  useCreateQuickReply,
  useUpdateQuickReply,
} from '../hooks/useQuickReplyMutations';
import { QuickReplyEditModal } from '../components/QuickReplyEditModal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { QuickReply } from '../model/quickReply';

const CATEGORY_OPTIONS = ['billing', 'account', 'technical', 'general'];

/**
 * The admin quick-reply library (`8.WisalQuickReplies` artboards). Filter
 * and pagination state lives entirely in the URL — never component state.
 */
export function QuickRepliesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') ?? '';
  const status = searchParams.get('status') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      return next;
    });
  };

  const { data, isPending, isError, refetch } = useQuickReplies({
    category: category || undefined,
    status: status || undefined,
    page,
  });

  const createMutation = useCreateQuickReply();
  const updateMutation = useUpdateQuickReply();
  const archiveMutation = useArchiveQuickReply();

  const [editTarget, setEditTarget] = useState<QuickReply | 'new' | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<QuickReply | null>(null);

  const items = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="qr-page">
      <div className="qr-page-head">
        <div>
          <h1 className="qr-page-title">Quick Replies</h1>
          {meta && <p className="qr-page-subtitle">{meta.total} templates in the shared library</p>}
        </div>
        <button type="button" className="tq-btn-primary fv" onClick={() => setEditTarget('new')}>
          New quick reply
        </button>
      </div>

      <div className="qr-filter-row">
        <label className="qr-filter-chip">
          <span>Category:</span>
          <select value={category} onChange={(e) => setParam('category', e.target.value)}>
            <option value="">All</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="qr-filter-chip">
          <span>Status:</span>
          <select value={status} onChange={(e) => setParam('status', e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {isError ? (
        <div className="qr-page-state">
          <p className="qr-page-state-title">Couldn't load quick replies</p>
          <p className="qr-page-state-body">
            Something went wrong while fetching the library. Check your connection and try again.
          </p>
          <button type="button" className="tq-btn-outline fv" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : isPending ? (
        <div className="qr-table-wrap" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="qr-row-skeleton sk" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="qr-page-state">
          <p className="qr-page-state-title">No quick replies yet</p>
          <p className="qr-page-state-body">
            Quick replies are shared reply templates your team can insert into ticket responses in
            one click — great for common questions like password resets or refund policy.
          </p>
          <button type="button" className="tq-btn-primary fv" onClick={() => setEditTarget('new')}>
            Create your first quick reply
          </button>
        </div>
      ) : (
        <div className="qr-table-wrap">
          <table className="qr-table">
            <thead>
              <tr>
                <th className="qr-th">TITLE</th>
                <th className="qr-th">PREVIEW</th>
                <th className="qr-th">CATEGORY</th>
                <th className="qr-th">STATUS</th>
                <th className="qr-th">LAST UPDATED</th>
                <th className="qr-th">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {items.map((qr) => (
                <tr key={qr.id}>
                  <td>{qr.title}</td>
                  <td className="qr-td-preview">{qr.preview}</td>
                  <td className="qr-td-category">{qr.category}</td>
                  <td>
                    <span className={`qr-status-pill qr-status-pill--${qr.status}`}>
                      {qr.status_label.toUpperCase()}
                    </span>
                  </td>
                  <td>{new Date(qr.updated_at).toLocaleDateString()} · {qr.updated_by ?? qr.created_by}</td>
                  <td className="qr-td-actions">
                    <button type="button" className="link-btn fv" onClick={() => setEditTarget(qr)}>
                      Edit
                    </button>
                    {qr.status === 'active' && (
                      <button type="button" className="link-btn fv" onClick={() => setArchiveTarget(qr)}>
                        Archive
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {meta && (
            <div className="qr-pagination">
              <span>
                Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total}
              </span>
              <div className="qr-pagination-pages">
                {Array.from({ length: meta.last_page }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`qr-page-btn${p === meta.current_page ? ' qr-page-btn-active' : ''}`}
                    onClick={() => setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set('page', String(p));
                      return next;
                    })}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <QuickReplyEditModal
        open={editTarget !== null}
        quickReply={editTarget === 'new' ? null : editTarget}
        onClose={() => setEditTarget(null)}
        onSave={(values) =>
          editTarget === 'new' || editTarget === null
            ? createMutation.mutateAsync(values)
            : updateMutation.mutateAsync({ id: editTarget.id, values })
        }
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive quick reply?"
        body={
          archiveTarget
            ? `Archive "${archiveTarget.title}"? Agents will no longer see it in the quick-reply picker. You can restore it later from the Archived filter.`
            : ''
        }
        confirmLabel="Archive"
        tone="danger"
        isPending={archiveMutation.isPending}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (!archiveTarget) return;
          archiveMutation.mutate(archiveTarget.id, { onSuccess: () => setArchiveTarget(null) });
        }}
      />
    </div>
  );
}
