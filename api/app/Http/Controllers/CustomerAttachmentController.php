<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCustomerAttachmentRequest;
use App\Http\Resources\CustomerAttachmentResource;
use App\Models\Customer;
use App\Models\CustomerAttachment;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerAttachmentController extends Controller
{
    use AuthorizesRequests;

    public function index(Customer $customer): AnonymousResourceCollection
    {
        $this->authorize('view', $customer);

        return CustomerAttachmentResource::collection(
            $customer->attachments()->latest()->paginate(20)
        );
    }

    public function store(StoreCustomerAttachmentRequest $request, Customer $customer)
    {
        $this->authorize('addAttachment', $customer);

        $file = $request->file('file');
        $disk = config('attachments.disk');

        // Laravel generates a random filename; the original name is stored
        // in the DB column, never used as the on-disk path. A user-controlled
        // filename on disk is a traversal and an overwrite waiting to happen.
        $path = $file->store("customer-attachments/{$customer->id}", $disk);

        $attachment = $customer->attachments()->create([
            'uploaded_by' => $request->user()->id,
            'disk' => $disk,
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize(),
        ]);

        return (new CustomerAttachmentResource($attachment))->response()->setStatusCode(201);
    }

    public function download(Customer $customer, CustomerAttachment $attachment): StreamedResponse
    {
        $this->authorize('view', $customer);

        // The nested route is decorative without this check — any id would
        // otherwise be readable by pairing it with a customer the caller may see.
        abort_unless($attachment->customer_id === $customer->id, 404);

        abort_unless(
            Storage::disk($attachment->disk)->exists($attachment->path),
            404,
            'That file is no longer available.'
        );

        return Storage::disk($attachment->disk)->download($attachment->path, $attachment->original_name);
    }

    public function destroy(Customer $customer, CustomerAttachment $attachment)
    {
        abort_unless($attachment->customer_id === $customer->id, 404);

        $this->authorize('deleteAttachment', $attachment);

        // Storage::delete tolerates a missing file — it returns false, it
        // does not throw.
        Storage::disk($attachment->disk)->delete($attachment->path);
        $attachment->delete();

        return response()->json(null, 204);
    }
}
