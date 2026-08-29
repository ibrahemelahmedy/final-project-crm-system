// Mirrors App\Http\Resources\KbArticleResource and KbArticleSummaryResource.
// Story 05's composer and any later "suggested solutions" story read
// ArticleSummary — treat it as frozen: add optional fields, never rename one.

export type ArticleStatus = 'draft' | 'published' | 'archived';

export type ArticleCategoryRef = {
  id: number;
  name: string;
  slug: string;
};

export type ArticleAuthorRef = {
  id: number;
  name: string;
};

export type ArticleSummary = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  status: ArticleStatus;
  status_label: string;
  category: ArticleCategoryRef | null;
  author?: ArticleAuthorRef | null;
  view_count: number;
  published_at: string | null;
  updated_at: string;
};

export type TocEntry = {
  id: string;
  text: string;
  level: number;
};

export type Article = ArticleSummary & {
  /** Raw Markdown. For the EDITOR only — never rendered as HTML. */
  body: string | null;
  /** Sanitized server-side on write. The ONLY field the reader renders. */
  body_html: string | null;
  created_at: string;
  version_count: number;
  read_minutes: number;
  /** Derived from the CONTENT, independent of the app-wide direction. */
  direction: 'rtl' | 'ltr';
  toc: TocEntry[];
};

export type ArticleCategory = {
  id: number;
  name: string;
  slug: string;
  article_count: number;
};

export type CategoriesResponse = {
  data: ArticleCategory[];
  total: number;
  published_total: number;
};

export type SearchResponse = {
  data: ArticleSummary[];
  /** Echoed back so the Empty state can quote what the agent actually typed. */
  query: string;
};

export type BulkResult = {
  action: string;
  affected: number;
  /** Drafts publish skipped because a required field was missing. */
  skipped: { id: number; title: string }[];
};

export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

/**
 * THE article reference format, owned by Story 09 and consumed by Story 05's
 * reply composer. One definition — a second copy of this template anywhere is
 * how the picker and the composer drift apart.
 */
export function articleReference(article: Pick<ArticleSummary, 'title' | 'slug'>): string {
  return `[${article.title}](/knowledge-base/${article.slug})`;
}
