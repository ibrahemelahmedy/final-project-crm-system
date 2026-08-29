import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useKbArticle, useKbCategories } from '../hooks/useKbQueries';
import { useMarkdownPreview } from '../hooks/useMarkdownPreview';
import {
  useCreateArticle,
  usePublishArticle,
  useUnpublishArticle,
  useUpdateArticle,
} from '../hooks/useKbMutations';
import { draftSchema, publishSchema, type ArticleFormValues } from '../model/articleSchema';
import { ArticleStatusBadge } from '../components/ArticleStatusBadge';

type FieldErrors = Partial<Record<keyof ArticleFormValues, string>>;

const EMPTY: ArticleFormValues = { title: '', body: '', kb_category_id: '' };

/** Maps a Laravel 422 onto the same field keys the Zod schema uses. */
function serverErrors(error: unknown): FieldErrors {
  const data = (error as AxiosError<{ errors?: Record<string, string[]> }>)?.response?.data;
  const errors = data?.errors ?? {};
  const mapped: FieldErrors = {};
  if (errors.title?.[0]) mapped.title = errors.title[0];
  if (errors.body?.[0]) mapped.body = errors.body[0];
  if (errors.kb_category_id?.[0]) mapped.kb_category_id = errors.kb_category_id[0];
  return mapped;
}

/**
 * The authoring surface — a Markdown textarea with a preview pane, NOT a
 * WYSIWYG (explicitly out of scope).
 *
 * Two distinct actions: Save draft needs only a title; Publish additionally
 * needs a body and a category, matching ArticleWriter::assertPublishable() on
 * the server. The Zod check exists so the editor can name the missing field
 * without a round trip; the server's copy is the actual boundary.
 */
export const ArticleEditorPage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(slug);

  const existing = useKbArticle(slug);
  const categories = useKbCategories();

  const [values, setValues] = useState<ArticleFormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [hydratedFrom, setHydratedFrom] = useState<string | null>(null);

  const create = useCreateArticle();
  const update = useUpdateArticle(slug ?? '');
  const publish = usePublishArticle();
  const unpublish = useUnpublishArticle();

  const preview = useMarkdownPreview(values.body);

  // Hydrate ONCE per article, from the fetched row. Adjusting state DURING
  // render is React's documented pattern for "reset state when a prop
  // changes" — an effect here would render an empty form first and then
  // overwrite it, and would also fight every background refetch for control
  // of whatever the author has typed since.
  if (isEdit && existing.data && hydratedFrom !== existing.data.slug) {
    setHydratedFrom(existing.data.slug);
    setValues({
      title: existing.data.title,
      body: existing.data.body ?? '',
      kb_category_id: existing.data.category?.id ?? '',
    });
  }

  const isPending =
    create.isPending || update.isPending || publish.isPending || unpublish.isPending;

  const set = <K extends keyof ArticleFormValues>(key: K, value: ArticleFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  };

  const validate = (schema: typeof draftSchema | typeof publishSchema): boolean => {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const next: FieldErrors = {};
    parsed.error.issues.forEach((issue) => {
      const key = issue.path[0] as keyof ArticleFormValues;
      if (key && !next[key]) next[key] = issue.message;
    });
    setErrors(next);
    return false;
  };

  /** @returns the slug of the saved article, or null if the save failed. */
  const save = async (): Promise<string | null> => {
    try {
      if (isEdit) {
        await update.mutateAsync(values);
        return slug as string;
      }
      const created = await create.mutateAsync(values);
      return created.slug;
    } catch (error) {
      const mapped = serverErrors(error);
      setErrors(mapped);
      if (Object.keys(mapped).length === 0) {
        setFormError('This article could not be saved. Try again.');
      }
      return null;
    }
  };

  const onSaveDraft = async () => {
    if (!validate(draftSchema)) return;
    const saved = await save();
    if (saved) navigate(`/knowledge-base/${saved}`);
  };

  const onPublish = async () => {
    // The publish gate is checked BEFORE saving, so an author is told what is
    // missing without the article silently landing as a draft first.
    if (!validate(publishSchema)) return;
    const saved = await save();
    if (!saved) return;
    try {
      await publish.mutateAsync(saved);
      navigate(`/knowledge-base/${saved}`);
    } catch (error) {
      setErrors(serverErrors(error));
    }
  };

  const onUnpublish = async () => {
    if (!slug) return;
    await unpublish.mutateAsync(slug);
  };

  const categoryOptions = useMemo(() => categories.data?.data ?? [], [categories.data]);

  if (isEdit && existing.isPending) {
    return (
      <div className="kb-editor" aria-busy="true">
        <span className="sk" style={{ width: 260, height: 26 }} />
        <span className="sk" style={{ width: '100%', height: 320, marginTop: 20, borderRadius: 10 }} />
      </div>
    );
  }

  if (isEdit && existing.isError) {
    return (
      <div className="kb-reader kb-reader-state">
        <h1>Article not found</h1>
        <p>This article does not exist, or it is not available to you.</p>
        <Link className="dt-btn dt-btn-primary fv" to="/knowledge-base">
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  return (
    <div className="kb-editor">
      <div className="page-title-row">
        <div>
          <h1>{isEdit ? 'Edit article' : 'New article'}</h1>
          <p className="page-subtitle">
            Written in Markdown. Raw HTML is removed when the article is saved.
          </p>
        </div>
        <div className="kb-editor-actions">
          {isEdit && existing.data && (
            <ArticleStatusBadge
              status={existing.data.status}
              label={existing.data.status_label}
            />
          )}
          <Link className="dt-btn dt-btn-outline fv" to="/knowledge-base">
            Cancel
          </Link>
          {isEdit && existing.data?.status === 'published' && (
            <button
              type="button"
              className="dt-btn dt-btn-outline fv"
              disabled={isPending}
              onClick={onUnpublish}
            >
              Unpublish
            </button>
          )}
          <button
            type="button"
            className="dt-btn dt-btn-outline fv"
            disabled={isPending}
            onClick={onSaveDraft}
          >
            Save draft
          </button>
          <button
            type="button"
            className="dt-btn dt-btn-primary fv"
            disabled={isPending}
            onClick={onPublish}
          >
            Publish
          </button>
        </div>
      </div>

      {formError && (
        <p className="kb-editor-form-error" role="alert">
          {formError}
        </p>
      )}

      <div className="kb-editor-split">
        <div className="kb-editor-form">
          <div className="form-field">
            <label htmlFor="kb-title">Title</label>
            <input
              id="kb-title"
              className="fv"
              type="text"
              value={values.title}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'kb-title-error' : undefined}
              onChange={(e) => set('title', e.target.value)}
            />
            {errors.title && (
              <p className="form-error" id="kb-title-error">
                {errors.title}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="kb-category">Category</label>
            <select
              id="kb-category"
              className="fv"
              value={String(values.kb_category_id)}
              aria-invalid={Boolean(errors.kb_category_id)}
              aria-describedby={errors.kb_category_id ? 'kb-category-error' : undefined}
              onChange={(e) => set('kb_category_id', e.target.value)}
            >
              <option value="">Select a category…</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.kb_category_id && (
              <p className="form-error" id="kb-category-error">
                {errors.kb_category_id}
              </p>
            )}
          </div>

          <div className="form-field kb-editor-body-field">
            <label htmlFor="kb-body">Body (Markdown)</label>
            <textarea
              id="kb-body"
              className="kb-editor-textarea fv"
              rows={20}
              value={values.body}
              aria-invalid={Boolean(errors.body)}
              aria-describedby={errors.body ? 'kb-body-error' : undefined}
              onChange={(e) => set('body', e.target.value)}
            />
            {errors.body && (
              <p className="form-error" id="kb-body-error">
                {errors.body}
              </p>
            )}
          </div>
        </div>

        <div className="kb-editor-preview">
          <div className="kb-editor-preview-label">PREVIEW</div>
          {values.body.trim() === '' ? (
            <p className="kb-editor-preview-empty">
              The preview appears here as you write, rendered exactly as the reader will show it.
            </p>
          ) : (
            <div
              className="kb-article-body"
              data-testid="kb-preview-body"
              // Same server-rendered, server-sanitized HTML the reader gets —
              // NOT a second browser-side Markdown renderer. A payload cannot
              // look safe here and behave differently once saved.
              dir={preview.data?.direction ?? 'ltr'}
              dangerouslySetInnerHTML={{ __html: preview.data?.body_html ?? '' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
