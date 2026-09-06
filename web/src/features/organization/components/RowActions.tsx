import { useT } from '../../../i18n';

const EDIT_ICON_PATH = 'M4 20h4l11-11-4-4L4 16z M14.5 5.5l4 4';

/**
 * The two artboard glyphs — edit pencil, and a red circle-with-a-minus
 * (a deactivate control, not a trash can — Decision 10). There is no
 * DELETE route for either entity; reactivating an already-deactivated row
 * happens through the edit modal's Active checkbox, not a third button
 * here.
 */
export function RowActions({
  isActive,
  onEdit,
  onDeactivate,
  editLabel,
  deactivateLabel,
}: {
  isActive: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  editLabel: string;
  deactivateLabel: string;
}) {
  const { t } = useT('organization');

  return (
    <div className="org-row-actions">
      <button
        type="button"
        className="org-row-action-btn fv"
        aria-label={editLabel}
        title={editLabel}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={EDIT_ICON_PATH} />
        </svg>
      </button>
      <button
        type="button"
        className="org-row-action-btn org-row-action-btn-danger fv"
        aria-label={deactivateLabel}
        title={isActive ? deactivateLabel : t('actions.alreadyInactive')}
        disabled={!isActive}
        onClick={(e) => {
          e.stopPropagation();
          onDeactivate();
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" />
        </svg>
      </button>
    </div>
  );
}
