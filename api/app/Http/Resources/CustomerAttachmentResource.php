<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerAttachmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'size_label' => $this->sizeLabel(),
            'uploaded_by' => $this->uploader ? [
                'id' => $this->uploader->id,
                'name' => $this->uploader->name,
            ] : null,
            'created_at' => $this->created_at,
            // Never expose path or disk — a storage path is an invitation
            // to probe the filesystem.
            'download_url' => route('customers.attachments.download', [
                'customer' => $this->customer_id,
                'attachment' => $this->id,
            ]),
        ];
    }

    private function sizeLabel(): string
    {
        $bytes = (int) $this->size_bytes;

        if ($bytes < 1024) {
            return "{$bytes} B";
        }

        if ($bytes < 1024 * 1024) {
            return round($bytes / 1024, 1).' KB';
        }

        return round($bytes / (1024 * 1024), 1).' MB';
    }
}
