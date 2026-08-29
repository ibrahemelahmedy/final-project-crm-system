import { api } from '../../../lib/api';
import type { KbListParams } from '../hooks/useKbListParams';
import type {
  Article,
  ArticleSummary,
  BulkResult,
  CategoriesResponse,
  Paginated,
  SearchResponse,
  TocEntry,
} from '../model/article';
import type { ArticleFormValues } from '../model/articleSchema';

// Every HTTP call for this feature lives here, importing the one shared Axios
// instance — never `axios` directly.

function listParamsToQuery(params: Partial<KbListParams>) {
  const query: Record<string, unknown> = {};
  if (params.q) query.q = params.q;
  if (params.category?.length) query.category = params.category;
  if (params.status?.length) query.status = params.status;
  if (params.sort) query.sort = params.sort;
  if (params.dir) query.dir = params.dir;
  if (params.page) query.page = params.page;
  if (params.per_page) query.per_page = params.per_page;
  return query;
}

// Blank strings become null so an untouched optional field is not stored as
// an empty string the server then has to treat as "present".
function toPayload(values: ArticleFormValues) {
  return {
    title: values.title.trim(),
    body: values.body.trim() === '' ? null : values.body,
    kb_category_id: values.kb_category_id === '' ? null : Number(values.kb_category_id),
  };
}

export async function listArticles(params: KbListParams): Promise<Paginated<ArticleSummary>> {
  const { data } = await api.get('/kb/articles', { params: listParamsToQuery(params) });
  return data;
}

export async function listCategories(): Promise<CategoriesResponse> {
  const { data } = await api.get('/kb/categories');
  return data;
}

export async function listMostViewed(): Promise<ArticleSummary[]> {
  const { data } = await api.get('/kb/articles/most-viewed');
  return data.data;
}

export async function getArticle(slug: string): Promise<Article> {
  const { data } = await api.get(`/kb/articles/${slug}`);
  return data.data;
}

/**
 * The endpoint ArticlePickerPanel calls, so an agent can find an article
 * without leaving the ticket.
 */
export async function searchArticles(q: string, limit = 8): Promise<SearchResponse> {
  const { data } = await api.get('/kb/search', { params: { q, limit } });
  return data;
}

export type PreviewResponse = {
  body_html: string;
  toc: TocEntry[];
  direction: 'rtl' | 'ltr';
  read_minutes: number;
};

/**
 * Renders un-saved Markdown through the SAME server pipeline that writes
 * body_html. The editor preview must not be a second, browser-side renderer —
 * see api/app/Http/Controllers/Kb/KbPreviewController.php.
 */
export async function previewMarkdown(body: string): Promise<PreviewResponse> {
  const { data } = await api.post('/kb/preview', { body });
  return data;
}

export async function createArticle(values: ArticleFormValues): Promise<Article> {
  const { data } = await api.post('/kb/articles', toPayload(values));
  return data.data;
}

export async function updateArticle(slug: string, values: ArticleFormValues): Promise<Article> {
  const { data } = await api.patch(`/kb/articles/${slug}`, toPayload(values));
  return data.data;
}

export async function publishArticle(slug: string): Promise<Article> {
  const { data } = await api.post(`/kb/articles/${slug}/publish`);
  return data.data;
}

export async function unpublishArticle(slug: string): Promise<Article> {
  const { data } = await api.post(`/kb/articles/${slug}/unpublish`);
  return data.data;
}

export async function archiveArticle(slug: string): Promise<Article> {
  const { data } = await api.post(`/kb/articles/${slug}/archive`);
  return data.data;
}

export type KbBulkPayload = {
  action: 'publish' | 'unpublish' | 'archive';
  ids: number[];
};

export async function bulkArticleAction(payload: KbBulkPayload): Promise<BulkResult> {
  const { data } = await api.post('/kb/articles/bulk', payload);
  return data;
}
