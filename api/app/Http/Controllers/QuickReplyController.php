<?php

namespace App\Http\Controllers;

use App\Enums\QuickReplyStatus;
use App\Http\Requests\IndexQuickReplyRequest;
use App\Http\Requests\StoreQuickReplyRequest;
use App\Http\Requests\UpdateQuickReplyRequest;
use App\Http\Resources\QuickReplyResource;
use App\Models\QuickReply;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * The admin quick-reply library (`8.WisalQuickReplies` artboards). Read is
 * open to any authenticated user (`QuickReplyPolicy::viewAny`); write is
 * Team Lead / Administrator only — the ownership decision documented in the
 * plan (shared library, no personal scope).
 */
class QuickReplyController extends Controller
{
    use AuthorizesRequests;

    public function index(IndexQuickReplyRequest $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', QuickReply::class);

        $quickReplies = QuickReply::query()
            ->filter($request->validated())
            ->orderByDesc('updated_at')
            ->paginate(10)
            ->withQueryString();

        return QuickReplyResource::collection($quickReplies);
    }

    public function store(StoreQuickReplyRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['status'] ??= QuickReplyStatus::Active->value;
        $data['created_by'] = $request->user()->id;
        $data['updated_by'] = $request->user()->id;

        $quickReply = QuickReply::create($data);

        return (new QuickReplyResource($quickReply))->response()->setStatusCode(201);
    }

    public function update(UpdateQuickReplyRequest $request, QuickReply $quickReply): QuickReplyResource
    {
        $data = $request->validated();
        $data['updated_by'] = $request->user()->id;

        $quickReply->update($data);

        return new QuickReplyResource($quickReply);
    }

    public function archive(QuickReply $quickReply): QuickReplyResource
    {
        $this->authorize('archive', $quickReply);

        // Archiving hides the template from the picker and from the
        // ticket-scoped list; messages already sent from it are untouched —
        // the message stores rendered text, not a foreign key to the template.
        $quickReply->update([
            'status' => QuickReplyStatus::Archived->value,
            'updated_by' => request()->user()->id,
        ]);

        return new QuickReplyResource($quickReply);
    }
}
