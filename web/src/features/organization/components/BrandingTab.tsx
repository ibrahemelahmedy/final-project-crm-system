import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n';
import { useBranding } from '../hooks/useBranding';
import { useRemoveLogo, useSavePrimaryColor, useUploadLogo } from '../hooks/useSaveBranding';
import { evaluate } from '../model/contrast';

const DEFAULT_COLOR = '#4F46E5';

/**
 * BrandingTab — docs/design/references/19.WisalOrgSettings-Branding/. The
 * hint copy deliberately reads PNG/JPG/WEBP, not the artboard's "SVG or
 * PNG" — SVG is rejected server-side (Decision 6: the logo is served from
 * a public URL that bypasses SecurityHeaders, so a stored SVG would
 * execute its own scripts on this origin).
 */
export function BrandingTab() {
  const { t } = useT('organization');
  const { data, isLoading } = useBranding();
  const saveColor = useSavePrimaryColor();
  const uploadLogo = useUploadLogo();
  const removeLogo = useRemoveLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draftColor, setDraftColor] = useState(DEFAULT_COLOR);

  useEffect(() => {
    if (data) setDraftColor(data.primary_color ?? DEFAULT_COLOR);
  }, [data]);

  const verdict = evaluate(draftColor);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogo.mutate(file);
    e.target.value = '';
  };

  const onSave = () => {
    saveColor.mutate(draftColor);
  };

  const onReset = () => {
    setDraftColor(DEFAULT_COLOR);
    saveColor.mutate(null);
    if (data?.logo_url) removeLogo.mutate();
  };

  if (isLoading) {
    return (
      <div className="org-tab-panel org-branding-grid">
        <div className="org-branding-card">
          <span className="sk" style={{ width: 140, height: 16, display: 'block' }} />
        </div>
      </div>
    );
  }

  const hasLogo = Boolean(data?.logo_url);

  return (
    <div className="org-tab-panel org-branding-grid">
      <div className="org-branding-card">
        <h2 className="org-branding-section-title">{t('branding.logoTitle')}</h2>
        <p className="org-branding-status">
          {hasLogo ? t('branding.customLogoUploaded') : t('branding.defaultMark')}
        </p>
        <p className="form-hint">{t('branding.logoHint')}</p>
        <div className="org-branding-logo-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={onFileChange}
          />
          <button type="button" className="dt-btn dt-btn-outline fv" onClick={() => fileInputRef.current?.click()}>
            {t('branding.uploadNew')}
          </button>
          <button
            type="button"
            className="dt-btn dt-btn-outline fv"
            disabled={!hasLogo || removeLogo.isPending}
            onClick={() => removeLogo.mutate()}
          >
            {t('branding.remove')}
          </button>
        </div>

        <div className="org-branding-divider" />

        <h2 className="org-branding-section-title">{t('branding.primaryColorTitle')}</h2>
        <div className="org-color-picker-row">
          <input
            type="color"
            className="org-color-swatch fv"
            value={draftColor}
            onChange={(e) => setDraftColor(e.target.value)}
            aria-label={t('branding.primaryColorTitle')}
          />
          <input
            type="text"
            className="org-color-hex-input fv"
            value={draftColor}
            dir="ltr"
            onChange={(e) => setDraftColor(e.target.value)}
          />
        </div>

        {verdict.passes ? (
          <p className="org-contrast-pass">
            {'✓ '}
            {t('branding.contrastPass', {
              light: verdict.onLight.toFixed(2),
              dark: verdict.onDark.toFixed(2),
            })}
          </p>
        ) : (
          <p className="org-contrast-warn">
            {t('branding.contrastWarn', {
              hex: draftColor.toUpperCase(),
              ratio: Math.min(verdict.onLight, verdict.onDark).toFixed(1),
            })}
          </p>
        )}

        <div className="org-branding-actions">
          <button type="button" className="dt-btn dt-btn-primary fv" disabled={saveColor.isPending} onClick={onSave}>
            {t('branding.saveChanges')}
          </button>
          <button type="button" className="dt-btn dt-btn-text fv" onClick={onReset}>
            {t('branding.resetToDefault')}
          </button>
        </div>
      </div>

      <div className="org-branding-card">
        <h2 className="org-branding-section-title">{t('branding.livePreviewTitle')}</h2>
        <div className="org-brand-preview-row" style={{ color: draftColor }}>
          {hasLogo && data?.logo_url ? (
            <img src={data.logo_url} alt="" className="org-brand-preview-logo" />
          ) : (
            <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true">
              <circle cx="24" cy="32" r="14" fill="none" stroke="currentColor" strokeWidth="7" />
              <circle cx="42" cy="32" r="9" fill="none" stroke="currentColor" strokeWidth="7" />
            </svg>
          )}
          <span className="org-brand-preview-title">{t('common:brand')}</span>
        </div>
        <p className="form-hint">{t('branding.previewCaption')}</p>
      </div>
    </div>
  );
}
