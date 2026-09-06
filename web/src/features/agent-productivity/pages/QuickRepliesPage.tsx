import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useT, formatDate } from '../../../i18n';
import { useQuickReplies } from '../hooks/useQuickReplies';
import {
  useArchiveQuickReply,
  useCreateQuickReply,
  useUpdateQuickReply,
} from '../hooks/useQuickReplyMutations';
import { QuickReplyEditModal } from '../components/QuickReplyEditModal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { QuickReply } from '../model/quickReply';

const CATEGORY_OPTIONS = ['billing', 'account', 'technical', 'general'] as const;
const CATEGORY_LABEL_KEYS: Record<(typeof CATEGORY_OPTIONS)[number], string> = {
  billing: 'quickRepliesPage.categories.billing',
  account: 'quickRepliesPage.categories.account',
  technical: 'quickRepliesPage.categories.technical',
  general: 'quickRepliesPage.categories.general',
};

/**
 * The admin quick-reply library (`8.WisalQuickReplies` artboards). Filter
 * and pagination state lives entirely in the URL — never component state.
 */
export function QuickRepliesPage() {
  const { t } = useT('productivity');
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
          <h1 className="qr-page-title">{t('quickRepliesPage.title')}</h1>
          {meta && <p className="qr-page-subtitle">{t('quickRepliesPage.subtitle', { count: meta.total })}</p>}
        </div>
        <button type="button" className="tq-btn-primary fv" onClick={() => setEditTarget('new')}>
          {t('quickRepliesPage.newQuickReply')}
        </button>
      </div>

      <div className="qr-filter-row">
        <label className="qr-filter-chip">
          <span>{t('quickRepliesPage.categoryLabel')}</span>
          <select value={category} onChange={(e) => setParam('category', e.target.value)}>
            <option value="">{t('quickRepliesPage.all')}</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {t(CATEGORY_LABEL_KEYS[c])}
              </option>
            ))}
          </select>
        </label>
        <label className="qr-filter-chip">
          <span>{t('quickRepliesPage.statusLabel')}</span>
          <select value={status} onChange={(e) => setParam('status', e.target.value)}>
            <option value="">{t('quickRepliesPage.all')}</option>
            <option value="active">{t('quickRepliesPage.active')}</option>
            <option value="archived">{t('quickRepliesPage.archived')}</option>
          </select>
        </label>
      </div>

      {isError ? (
        <div className="qr-page-state">
          <p className="qr-page-state-title">{t('quickRepliesPage.loadErrorTitle')}</p>
          <p className="qr-page-state-body">{t('quickRepliesPage.loadErrorBody')}</p>
          <button type="button" className="tq-btn-outline fv" onClick={() => refetch()}>
            {t('quickRepliesPage.retry')}
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
          <p className="qr-page-state-title">{t('quickRepliesPage.emptyTitle')}</p>
          <p className="qr-page-state-body">{t('quickRepliesPage.emptyBody')}</p>
          <button type="button" className="tq-btn-primary fv" onClick={() => setEditTarget('new')}>
            {t('quickRepliesPage.createFirst')}
          </button>
        </div>
      ) : (
        <div className="qr-table-wrap">
          <table className="qr-table">
            <thead>
              <tr>
                <th className="qr-th">{t('quickRepliesPage.columns.title')}</th>
                <th className="qr-th">{t('quickRepliesPage.columns.preview')}</th>
                <th className="qr-th">{t('quickRepliesPage.columns.category')}</th>
                <th className="qr-th">{t('quickRepliesPage.columns.status')}</th>
                <th className="qr-th">{t('quickRepliesPage.columns.lastUpdated')}</th>
                <th className="qr-th">{t('quickRepliesPage.columns.actions')}</th>
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
                  <td>{formatDate(qr.updated_at)} · {qr.updated_by ?? qr.created_by}</td>
                  <td className="qr-td-actions">
                    <button type="button" className="link-btn fv" onClick={() => setEditTarget(qr)}>
                      {t('quickRepliesPage.edit')}
                    </button>
                    {qr.status === 'active' && (
                      <button type="button" className="link-btn fv" onClick={() => setArchiveTarget(qr)}>
                        {t('quickRepliesPage.archive')}
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
                {t('quickRepliesPage.showingRange', { from: meta.from ?? 0, to: meta.to ?? 0, total: meta.total })}
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
        title={t('quickRepliesPage.archiveConfirmTitle')}
        body={archiveTarget ? t('quickRepliesPage.archiveConfirmBody', { title: archiveTarget.title }) : ''}
        confirmLabel={t('quickRepliesPage.archive')}
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
