<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveDepartmentRequest;
use App\Http\Resources\DepartmentResource;
use App\Models\Department;
use App\Services\AuditTrail;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/** Story 20 (WIS-20). */
class DepartmentController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly AuditTrail $audit,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Department::class);

        return DepartmentResource::collection(
            Department::query()->with('branch')->withCount('users')->orderBy('name')->get()
        );
    }

    public function store(SaveDepartmentRequest $request): JsonResponse
    {
        $this->authorize('create', Department::class);

        $validated = $request->validated();

        $department = DB::transaction(function () use ($validated, $request) {
            $department = Department::create($validated);

            $this->audit->record(AuditTrail::DEPARTMENT_CHANGED, $request->user(), $request, [
                ...AuditTrail::target('department', $department->id, $department->name),
                'action' => 'created',
            ]);

            return $department;
        });

        $department->load('branch')->loadCount('users');

        return (new DepartmentResource($department))->response()->setStatusCode(201);
    }

    public function update(SaveDepartmentRequest $request, Department $department): JsonResponse
    {
        $this->authorize('update', $department);

        $validated = $request->validated();

        DB::transaction(function () use ($validated, $department, $request) {
            $department->fill($validated);

            // Writing the same values twice is not an event.
            if ($department->isDirty()) {
                $department->save();

                $this->audit->record(AuditTrail::DEPARTMENT_CHANGED, $request->user(), $request, [
                    ...AuditTrail::target('department', $department->id, $department->name),
                    'action' => 'updated',
                ]);
            }
        });

        $department->load('branch')->loadCount('users');

        return response()->json(['data' => new DepartmentResource($department)]);
    }
}
