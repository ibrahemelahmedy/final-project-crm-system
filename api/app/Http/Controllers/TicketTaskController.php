<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTicketTaskRequest;
use App\Http\Resources\TicketTaskResource;
use App\Models\Ticket;
use App\Models\TicketTask;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TicketTaskController extends Controller
{
    use AuthorizesRequests;

    public function index(Ticket $ticket): AnonymousResourceCollection
    {
        $this->authorize('view', $ticket);

        $tasks = $ticket->tasks()
            ->with(['assignee:id,name', 'creator:id,name', 'completer:id,name'])
            ->orderByRaw("CASE WHEN status = 'open' THEN 0 ELSE 1 END")
            ->orderBy('due_at')
            ->orderByDesc('created_at')
            ->get();

        return TicketTaskResource::collection($tasks);
    }

    public function store(StoreTicketTaskRequest $request, Ticket $ticket): JsonResponse
    {
        $data = $request->validated();

        // Defaults the assignee to the creator — the artboard's
        // "Sarah Ahmed (me)" default assignee.
        $data['assignee_id'] = $data['assignee_id'] ?? $request->user()->id;
        $data['created_by'] = $request->user()->id;
        $data['ticket_id'] = $ticket->id;
        $data['status'] = 'open';

        $task = TicketTask::create($data);

        return (new TicketTaskResource($task->load(['assignee:id,name', 'creator:id,name'])))
            ->response()->setStatusCode(201);
    }
}
