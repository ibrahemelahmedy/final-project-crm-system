<?php

namespace App\Http\Controllers\Portal;

use App\Enums\ArticleStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PortalArticleResource;
use App\Models\KbArticle;
use App\Services\Kb\ArticleSearch;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Story 17 (WIS-16, Customer Portal). AC6 — published KB articles, public,
 * no session. Read-only: nothing here writes to kb_articles beyond the
 * atomic view_count bump in show(), which mirrors
 * KbArticleController::show() exactly, including updated_at not moving.
 */
class PortalFaqController extends Controller
{
    public function __construct(private readonly ArticleSearch $search) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = KbArticle::query()
            ->where('status', ArticleStatus::Published->value)
            ->whereNotNull('published_at')
            ->with('category')
            ->when(
                $request->query('category'),
                fn ($q, $slugs) => $q->whereHas('category', fn ($c) => $c->whereIn('slug', (array) $slugs))
            );

        $term = trim((string) $request->query('q'));

        if ($term !== '') {
            $query = $this->search->apply($query, $term);
        } else {
            $query = $query->orderByDesc('published_at');
        }

        return PortalArticleResource::collection($query->paginate(20)->withQueryString());
    }

    public function show(string $slug): PortalArticleResource
    {
        $article = KbArticle::query()
            ->where('status', ArticleStatus::Published->value)
            ->whereNotNull('published_at')
            ->with('category')
            ->where('slug', $slug)
            ->firstOrFail();

        // A base-builder increment, never a read-modify-write, and it
        // deliberately does not move updated_at — see
        // KbArticleController::show()'s identical comment.
        KbArticle::whereKey($article->id)->getQuery()->increment('view_count');

        return new PortalArticleResource($article);
    }
}
