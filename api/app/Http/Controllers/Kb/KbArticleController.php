<?php

namespace App\Http\Controllers\Kb;

use App\Enums\ArticleStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\BulkKbArticleRequest;
use App\Http\Requests\IndexKbArticleRequest;
use App\Http\Requests\StoreKbArticleRequest;
use App\Http\Requests\UpdateKbArticleRequest;
use App\Http\Resources\KbArticleResource;
use App\Http\Resources\KbArticleSummaryResource;
use App\Models\KbArticle;
use App\Services\Kb\ArticleSearch;
use App\Services\Kb\ArticleWriter;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Knowledge Base articles (Story 09). Thin: every rule of consequence lives in
 * ArticleWriter, MarkdownRenderer, ArticleSearch, or KbArticle::scopeVisibleTo.
 */
class KbArticleController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly ArticleWriter $writer,
        private readonly ArticleSearch $search,
    ) {}

    public function index(IndexKbArticleRequest $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', KbArticle::class);

        $user = $request->user();

        $query = KbArticle::query()
            // visibleTo FIRST: a non-editor's drafts are gone before any
            // filter, sort, or ranking runs, not filtered out afterwards.
            ->visibleTo($user)
            ->with(['category', 'author'])
            ->when($request->query('category'), fn ($q, $slugs) => $q->whereHas(
                'category',
                fn ($c) => $c->whereIn('slug', (array) $slugs)
            ))
            ->when($request->query('status'), fn ($q, $s) => $q->whereIn('status', (array) $s));

        $term = trim((string) $request->query('q'));

        if ($term !== '') {
            // A query present means relevance ordering wins over the sort
            // column — a result list ordered by title while the user is
            // searching is not a search result.
            $query = $this->search->apply($query, $term);
        } else {
            $query
                ->orderBy($request->query('sort', 'updated_at'), $request->query('dir', 'desc'))
                // A secondary key keeps paging stable when the sort ties.
                ->orderBy('id');
        }

        return KbArticleSummaryResource::collection(
            $query->paginate(min((int) $request->query('per_page', 25), 100))->withQueryString()
        );
    }

    /**
     * The left rail's "MOST VIEWED" list. Published only, for everyone —
     * a draft has no meaningful view count and must not surface here even
     * for an editor.
     */
    public function mostViewed(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', KbArticle::class);

        return KbArticleSummaryResource::collection(
            KbArticle::query()
                ->where('status', ArticleStatus::Published->value)
                ->orderByDesc('view_count')
                ->orderByDesc('published_at')
                ->orderBy('id')
                ->limit(5)
                ->get()
        );
    }

    public function store(StoreKbArticleRequest $request): JsonResponse
    {
        $this->authorize('create', KbArticle::class);

        $article = $this->writer->create($request->validated(), $request->user());

        return (new KbArticleResource($article->load(['category', 'author'])))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * The reader payload. Route-model binding is deliberately NOT used: an
     * implicit binding resolves the row before scopeVisibleTo can exclude it,
     * which is exactly how a draft leaks a 403 instead of a 404.
     */
    public function show(Request $request, string $slug): KbArticleResource
    {
        $this->authorize('viewAny', KbArticle::class);

        $article = KbArticle::query()
            ->visibleTo($request->user())
            ->with(['category', 'author'])
            ->withCount('versions')
            ->where('slug', $slug)
            ->firstOrFail();

        // An atomic increment, never a read-modify-write: two readers landing
        // together must not overwrite each other's count. It is a soft metric,
        // and updated_at deliberately does not move — a view is not an edit,
        // and the reader's "Last updated" line must not lie because someone
        // opened the page.
        //
        // ->getQuery() drops to the BASE query builder on purpose. Eloquent's
        // own increment() injects `updated_at = now()` into the UPDATE, which
        // is exactly the behaviour the paragraph above forbids.
        KbArticle::whereKey($article->id)->getQuery()->increment('view_count');

        return new KbArticleResource($article);
    }

    public function update(UpdateKbArticleRequest $request, string $slug): KbArticleResource
    {
        $article = KbArticle::query()->where('slug', $slug)->firstOrFail();

        $this->authorize('update', $article);

        $data = $request->validated();

        // Editing a PUBLISHED article into a state it could not have been
        // published in is rejected — otherwise "required to publish" is
        // trivially bypassed by publishing first and blanking afterwards.
        if ($article->isPublished()) {
            $this->assertStillPublishable($article, $data);
        }

        $article = $this->writer->update($article, $data, $request->user());

        return new KbArticleResource($article->load(['category', 'author'])->loadCount('versions'));
    }

    public function publish(Request $request, string $slug): KbArticleResource
    {
        $article = KbArticle::query()->where('slug', $slug)->firstOrFail();

        $this->authorize('publish', $article);

        // Throws a 422 naming the missing field(s) — title, body, category.
        $this->writer->publish($article, $request->user(), $request);

        return new KbArticleResource($article->load(['category', 'author']));
    }

    public function unpublish(Request $request, string $slug): KbArticleResource
    {
        $article = KbArticle::query()->where('slug', $slug)->firstOrFail();

        $this->authorize('publish', $article);

        $this->writer->unpublish($article, $request->user(), $request);

        return new KbArticleResource($article->load(['category', 'author']));
    }

    public function archive(Request $request, string $slug): KbArticleResource
    {
        $article = KbArticle::query()->where('slug', $slug)->firstOrFail();

        $this->authorize('archive', $article);

        $this->writer->archive($article, $request->user(), $request);

        return new KbArticleResource($article->load(['category', 'author']));
    }

    /**
     * The bulk-action bar. One transaction for the whole batch: a partially
     * applied bulk action is worse than a failed one, because the operator
     * cannot tell which half landed.
     *
     * Publish skips — rather than fails — an article missing a required field,
     * and reports it back, so one incomplete draft in a selection of twenty
     * does not block the other nineteen.
     */
    public function bulk(BulkKbArticleRequest $request): JsonResponse
    {
        $this->authorize('bulk', KbArticle::class);

        $action = $request->validated('action');
        $ids = $request->validated('ids');
        $user = $request->user();

        $result = DB::transaction(function () use ($action, $ids, $user, $request) {
            $articles = KbArticle::whereIn('id', $ids)->get();
            $affected = 0;
            $skipped = [];

            foreach ($articles as $article) {
                if ($action === 'publish') {
                    try {
                        $this->writer->assertPublishable($article);
                    } catch (ValidationException) {
                        $skipped[] = ['id' => $article->id, 'title' => $article->title];

                        continue;
                    }

                    $this->writer->publish($article, $user, $request);
                } elseif ($action === 'unpublish') {
                    $this->writer->unpublish($article, $user, $request);
                } else {
                    $this->writer->archive($article, $user, $request);
                }

                $affected++;
            }

            return ['affected' => $affected, 'skipped' => $skipped];
        });

        return response()->json([
            'action' => $action,
            'affected' => $result['affected'],
            // Named so the UI can say WHICH drafts it could not publish
            // rather than reporting a silent count mismatch.
            'skipped' => $result['skipped'],
        ]);
    }

    /** @throws ValidationException */
    private function assertStillPublishable(KbArticle $article, array $data): void
    {
        $candidate = clone $article;
        $candidate->fill([
            'title' => $data['title'] ?? $article->title,
            'body' => array_key_exists('body', $data) ? $data['body'] : $article->body,
            'kb_category_id' => array_key_exists('kb_category_id', $data)
                ? $data['kb_category_id']
                : $article->kb_category_id,
        ]);

        $this->writer->assertPublishable($candidate);
    }
}
