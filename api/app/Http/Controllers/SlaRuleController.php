<?php

namespace App\Http\Controllers;

use App\Enums\Priority;
use App\Http\Requests\StoreSlaRuleRequest;
use App\Http\Requests\UpdateSlaRuleRequest;
use App\Http\Resources\SlaRuleResource;
use App\Models\SlaRule;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Story 06 (WIS-6). Administrator-only CRUD over the four SLA rules.
 *
 * Nothing here touches a ticket. Editing a rule leaves every existing
 * ticket's targets untouched — that is what makes a rule edit apply going
 * forward only, and SlaRuleIsNotRetroactiveTest asserts it directly.
 */
class SlaRuleController extends Controller
{
    use AuthorizesRequests;

    /**
     * Every rule, active and inactive, unpaginated — four rows maximum by the
     * unique constraint, and the screen shows deactivated rules so an
     * Administrator can reactivate one.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', SlaRule::class);

        // Urgent → High → Normal → Low, driven by Story 04's ordering
        // authority. A hand-written CASE here would duplicate a weight map
        // that already exists.
        return SlaRuleResource::collection(
            SlaRule::query()->orderBy(Priority::sortExpression('sla_rules.priority'), 'desc')->get()
        );
    }

    public function store(StoreSlaRuleRequest $request): JsonResponse
    {
        $rule = SlaRule::create($request->validated());

        return (new SlaRuleResource($rule))->response()->setStatusCode(201);
    }

    public function update(UpdateSlaRuleRequest $request, SlaRule $slaRule): SlaRuleResource
    {
        $slaRule->update($request->validated());

        return new SlaRuleResource($slaRule);
    }

    /**
     * Ships so a tier can be genuinely vacated and re-created with a different
     * threshold model. The screen does not expose it — the design has an edit
     * pencil and no delete control.
     */
    public function destroy(Request $request, SlaRule $slaRule): JsonResponse
    {
        $this->authorize('delete', $slaRule);

        $slaRule->delete();

        return response()->json(null, 204);
    }
}
