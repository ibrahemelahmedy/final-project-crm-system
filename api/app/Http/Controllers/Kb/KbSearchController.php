<?php

namespace App\Http\Controllers\Kb;

use App\Http\Controllers\Controller;
use App\Http\Resources\KbArticleSummaryResource;
use App\Models\KbArticle;
use App\Services\Kb\ArticleSearch;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /api/kb/search — relevance-ranked article search (Story 09).
 *
 * THE endpoint the ticket-side ArticlePickerPanel calls, so an agent can find
 * and reference an article without leaving the ticket. Kept separate from the
 * list endpoint on purpose: the picker wants a short, ranked, un-paginated
 * result and must not inherit the index's filter/sort/pagination contract.
 */
class KbSearchController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly ArticleSearch $search) {}

    public function __invoke(Request $request): JsonResponse
    {
        $this->authorize('viewAny', KbArticle::class);

        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:25'],
        ]);

        $term = trim((string) ($validated['q'] ?? ''));
        $limit = (int) ($validated['limit'] ?? 10);

        // An empty query is a 200 with an empty collection, never a 422. The
        // picker mounts before the agent has typed anything.
        if ($term === '') {
            return response()->json(['data' => [], 'query' => '']);
        }

        $query = KbArticle::query()
            // Drafts are excluded BEFORE ranking, not filtered out of a ranked
            // result afterwards — otherwise a draft consumes one of the N slots
            // and the agent silently sees fewer results than exist.
            // An editor's search DOES include their drafts, labelled by the
            // `status` field the summary resource carries.
            ->visibleTo($request->user())
            ->with(['category']);

        $results = $this->search->apply($query, $term)->limit($limit)->get();

        return response()->json([
            'data' => KbArticleSummaryResource::collection($results)->resolve(),
            // Echoed back so the Empty state can quote the query the agent ran.
            'query' => $term,
        ]);
    }
}
