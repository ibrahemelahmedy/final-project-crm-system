<?php

namespace App\Http\Controllers\Kb;

use App\Enums\ArticleStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\KbCategoryResource;
use App\Models\KbArticle;
use App\Models\KbCategory;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The index's left rail (Story 09) — the category list with counts, plus the
 * "All Articles" total the artboard shows beside it.
 */
class KbCategoryController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', KbArticle::class);

        $user = $request->user();

        $categories = KbCategory::query()
            // Counts are scoped to the CALLER, so an Agent's rail never totals
            // in a draft they cannot open. An editor's rail counts everything
            // they can actually see.
            ->withCount(['articles' => fn ($q) => $q->visibleTo($user)])
            ->orderBy('position')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => KbCategoryResource::collection($categories)->resolve(),
            // The "86 articles" subtitle and the "All Articles" rail row.
            'total' => KbArticle::query()->visibleTo($user)->count(),
            'published_total' => KbArticle::query()
                ->where('status', ArticleStatus::Published->value)
                ->count(),
        ]);
    }
}
