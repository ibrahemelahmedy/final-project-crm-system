<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveBranchRequest;
use App\Http\Resources\BranchResource;
use App\Models\Branch;
use App\Services\AuditTrail;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/** Story 20 (WIS-20). */
class BranchController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly AuditTrail $audit,
    ) {}

    /**
     * No pagination — neither artboard has a footer for one and branch
     * cardinality is small. withCount rather than N+1.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Branch::class);

        return BranchResource::collection(
            Branch::query()->withCount('users')->orderBy('name')->get()
        );
    }

    public function store(SaveBranchRequest $request): JsonResponse
    {
        $this->authorize('create', Branch::class);

        $validated = $request->validated();

        $branch = DB::transaction(function () use ($validated, $request) {
            $branch = Branch::create($validated);

            $this->audit->record(AuditTrail::BRANCH_CHANGED, $request->user(), $request, [
                ...AuditTrail::target('branch', $branch->id, $branch->name),
                'action' => 'created',
            ]);

            return $branch;
        });

        $branch->loadCount('users');

        return (new BranchResource($branch))->response()->setStatusCode(201);
    }

    public function update(SaveBranchRequest $request, Branch $branch): JsonResponse
    {
        $this->authorize('update', $branch);

        $validated = $request->validated();

        DB::transaction(function () use ($validated, $branch, $request) {
            $branch->fill($validated);

            // Writing the same values twice is not an event.
            if ($branch->isDirty()) {
                $branch->save();

                $this->audit->record(AuditTrail::BRANCH_CHANGED, $request->user(), $request, [
                    ...AuditTrail::target('branch', $branch->id, $branch->name),
                    'action' => 'updated',
                ]);
            }
        });

        $branch->loadCount('users');

        return response()->json(['data' => new BranchResource($branch)]);
    }
}
