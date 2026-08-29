<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Resources\DashboardTicketResource;
use App\Services\DashboardMetrics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Role-based home dashboards (Story 07 / WIS-9).
 *
 * One action per widget — this is the mechanism behind the independent-skeleton
 * acceptance criterion, so these must not be collapsed into one aggregate
 * response.
 *
 * Server-side authorization is the boundary; the SPA route guard is UX only.
 *
 * Story 08 consolidated the administrator-only endpoint onto the shared
 * `administrator` middleware (App\Http\Middleware\EnsureAdministrator). The
 * team endpoints keep the local assertRole() helper because
 * "team lead OR administrator" is a two-role predicate the single-role gate
 * does not express — it is a scoping rule for this controller, not a second
 * definition of the admin boundary.
 */
class DashboardController extends Controller
{
    public function __construct(private readonly DashboardMetrics $metrics)
    {
    }

    // ---- Agent (every authenticated role, scoped to the caller) -----------

    public function agentSummary(Request $request): JsonResponse
    {
        return response()->json($this->metrics->agentSummary($request->user()));
    }

    public function agentQueue(Request $request): AnonymousResourceCollection
    {
        return DashboardTicketResource::collection($this->metrics->agentQueue($request->user()));
    }

    public function agentSlaRisk(Request $request): AnonymousResourceCollection
    {
        return DashboardTicketResource::collection($this->metrics->agentSlaRisk($request->user()));
    }

    // ---- Team (team_lead + administrator) --------------------------------

    public function teamSummary(Request $request): JsonResponse
    {
        $this->assertRole($request, [UserRole::TeamLead, UserRole::Administrator]);

        return response()->json($this->metrics->teamSummary());
    }

    public function teamWorkload(Request $request): JsonResponse
    {
        $this->assertRole($request, [UserRole::TeamLead, UserRole::Administrator]);

        return response()->json($this->metrics->teamWorkload());
    }

    public function teamEscalations(Request $request): AnonymousResourceCollection
    {
        $this->assertRole($request, [UserRole::TeamLead, UserRole::Administrator]);

        return DashboardTicketResource::collection($this->metrics->teamEscalations());
    }

    // ---- Admin (administrator only) -------------------------------------

    /**
     * Story 08 consolidation: the administrator check that used to live here
     * is now the shared `administrator` middleware on this route in api.php.
     * There is one definition of "is an Administrator" in the app, and it is
     * not in this file.
     */
    public function adminSummary(Request $request): JsonResponse
    {
        return response()->json($this->metrics->adminSummary());
    }

    /**
     * @param  array<int, UserRole>  $roles
     */
    private function assertRole(Request $request, array $roles): void
    {
        if (! in_array($request->user()->role, $roles, true)) {
            throw new AccessDeniedHttpException('This dashboard is not available for your role.');
        }
    }
}
