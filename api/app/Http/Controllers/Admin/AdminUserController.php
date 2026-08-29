<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\IndexUserRequest;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\UserAdminService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Thin — every rule that matters lives in UserAdminService. In particular,
 * token revocation on deactivation is NOT done here.
 *
 * The route group already carries auth:sanctum + the administrator gate; the
 * policy calls are the second, per-action layer.
 */
class AdminUserController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly UserAdminService $users)
    {
    }

    /** Same server-side pagination / filter shape as Customers (Story 03). */
    public function index(IndexUserRequest $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', User::class);

        // The design's third chip defaults to "Status: Active", so an absent
        // status param means active — not "all".
        $status = $request->query('status', 'active');

        $users = User::query()
            ->search($request->query('q'))
            ->when($request->query('role'), fn ($q, $roles) => $q->whereIn('role', (array) $roles))
            ->when($request->query('department'), fn ($q, $d) => $q->whereIn('department', (array) $d))
            ->when($status === 'active', fn ($q) => $q->where('is_active', true))
            ->when($status === 'inactive', fn ($q) => $q->where('is_active', false))
            ->orderBy($request->query('sort', 'name'), $request->query('dir', 'asc'))
            // A secondary key keeps paging stable when the sort column ties.
            ->orderBy('id')
            ->paginate(min((int) $request->query('per_page', 25), 100))
            ->withQueryString();

        return UserResource::collection($users);
    }

    /**
     * The filter chips' option lists, plus the counts the header subtitle and
     * Story 07's Admin card read. Distinct NON-NULL departments only —
     * `department` is nullable and backfilled empty.
     */
    public function facets(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        $roleCounts = User::query()
            ->select('role')
            ->selectRaw('count(*) as aggregate')
            ->groupBy('role')
            ->pluck('aggregate', 'role');

        $departments = User::query()
            ->whereNotNull('department')
            ->where('department', '!=', '')
            ->select('department')
            ->selectRaw('count(*) as aggregate')
            ->groupBy('department')
            ->orderBy('department')
            ->get()
            ->map(fn ($row) => ['value' => $row->department, 'count' => (int) $row->aggregate]);

        return response()->json([
            'roles' => collect(UserRole::cases())->map(fn (UserRole $role) => [
                'value' => $role->value,
                'label' => $role->label(),
                'count' => (int) ($roleCounts[$role->value] ?? 0),
            ]),
            'departments' => $departments,
            'total' => User::count(),
            'active_total' => User::where('is_active', true)->count(),
            'department_total' => $departments->count(),
        ]);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $this->authorize('create', User::class);

        $user = $this->users->create(
            $request->validated(),
            $request->user(),
            $request,
        );

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function show(Request $request, User $user): UserResource
    {
        $this->authorize('view', $user);

        return new UserResource($user);
    }

    public function update(UpdateUserRequest $request, User $user): UserResource
    {
        $this->authorize('update', $user);

        return new UserResource(
            $this->users->update($user, $request->validated(), $request->user(), $request)
        );
    }

    public function deactivate(Request $request, User $user): UserResource
    {
        $this->authorize('deactivate', $user);

        return new UserResource(
            $this->users->deactivate($user, $request->user(), $request)
        );
    }

    public function activate(Request $request, User $user): UserResource
    {
        $this->authorize('activate', $user);

        return new UserResource(
            $this->users->activate($user, $request->user(), $request)
        );
    }
}
