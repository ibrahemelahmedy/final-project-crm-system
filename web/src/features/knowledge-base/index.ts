// The ONLY public surface of this feature. App.tsx and Story 05 import from
// here and nothing deeper.
export { KnowledgeBaseIndexPage } from './pages/KnowledgeBaseIndexPage';
export { ArticleReaderPage } from './pages/ArticleReaderPage';
export { ArticleEditorPage } from './pages/ArticleEditorPage';

// The component Story 05's reply composer mounts, so an agent can search the
// KB and insert a reference without leaving the ticket.
export { ArticlePickerPanel } from './components/ArticlePickerPanel';
export type { ArticlePickerPanelProps } from './components/ArticlePickerPanel';

// THE article reference format, owned here and consumed by Story 05.
export { articleReference } from './model/article';
export type { Article, ArticleSummary, ArticleStatus, ArticleCategory } from './model/article';
export { kbKeys } from './api/queryKeys';
