<?php

namespace App\Http\Controllers;

use App\Enums\TaskStatus;
use App\Http\Requests\UpdateTicketTaskRequest;
use App\Http\Resources\TicketTaskResource;
use App\Models\TicketTask;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TaskController extends Controller
{
    use AuthorizesRequests;

    /**
     * `GET /api/tasks?assignee=me&status=open` — the exact contract Story
     * 07's Agent Dashboard consumes. `assignee` currently only accepts
     * `me`; a numeric id is a Story 07 concern this story does not add.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = TicketTask::query()->with(['assignee:id,name', 'creator:id,name', 'ticket:id,subject']);

        if ($request->query('assignee') === 'me') {
            $query->where('assignee_id', $request->user()->id);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $tasks = $query->orderBy('due_at')->get();

        return TicketTaskResource::collection($tasks);
    }

    public function update(UpdateTicketTaskRequest $request, TicketTask $task): TicketTaskResource
    {
        $data = $request->validated();

        // Reassignment clears the reminder guard so the new assignee gets
        // reminded once (plan's "Reassigning a task after a reminder fired").
        if (array_key_exists('assignee_id', $data) && $data['assignee_id'] !== $task->assignee_id) {
            $data['reminded_at'] = null;
        }

        $task->update($data);

        return new TicketTaskResource($task->load(['assignee:id,name', 'creator:id,name']));
    }

    public function complete(TicketTask $task): TicketTaskResource
    {
        $this->authorize('complete', $task);

        $task->update([
            'status' => TaskStatus::Completed->value,
            'completed_by' => request()->user()->id,
            'completed_at' => now(),
        ]);

        return new TicketTaskResource($task->load(['assignee:id,name', 'creator:id,name', 'completer:id,name']));
    }
}
