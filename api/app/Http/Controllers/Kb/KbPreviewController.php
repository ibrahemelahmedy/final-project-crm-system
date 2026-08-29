<?php

namespace App\Http\Controllers\Kb;

use App\Http\Controllers\Controller;
use App\Models\KbArticle;
use App\Services\MarkdownRenderer;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * POST /api/kb/preview — render un-saved Markdown through the SAME pipeline
 * that writes body_html (Story 09).
 *
 * WHY THIS EXISTS. The story requires that "the editor preview runs the same
 * pipeline, so a payload cannot survive by being previewed instead of saved",
 * and that client-side sanitization alone is insufficient. Those two together
 * rule out rendering Markdown in the browser: the only way the preview can be
 * the same output as the reader is for the server to produce it.
 *
 * It writes nothing and touches no row — it is a pure function of the posted
 * text — but it is still behind the authoring policy, because an endpoint that
 * renders arbitrary attacker-supplied Markdown should not be open to every
 * reader.
 */
class KbPreviewController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly MarkdownRenderer $markdown) {}

    public function __invoke(Request $request): JsonResponse
    {
        $this->authorize('create', KbArticle::class);

        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:100000'],
        ]);

        $html = $this->markdown->render($validated['body'] ?? null);

        return response()->json([
            'body_html' => $html,
            'toc' => $this->markdown->toc($html),
            'direction' => $this->markdown->direction($validated['body'] ?? null),
            'read_minutes' => $this->markdown->readMinutes($html),
        ]);
    }
}
