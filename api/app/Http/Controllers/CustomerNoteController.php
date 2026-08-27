<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCustomerNoteRequest;
use App\Http\Resources\CustomerNoteResource;
use App\Models\Customer;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CustomerNoteController extends Controller
{
    use AuthorizesRequests;

    public function index(Customer $customer): AnonymousResourceCollection
    {
        $this->authorize('view', $customer);

        return CustomerNoteResource::collection(
            $customer->notes()->latest()->paginate(20)
        );
    }

    public function store(StoreCustomerNoteRequest $request, Customer $customer)
    {
        $this->authorize('addNote', $customer);

        $author = $request->user();

        $note = $customer->notes()->create([
            'user_id' => $author->id,
            'author_name' => $author->name,
            'body' => $request->validated('body'),
        ]);

        return (new CustomerNoteResource($note))->response()->setStatusCode(201);
    }
}
