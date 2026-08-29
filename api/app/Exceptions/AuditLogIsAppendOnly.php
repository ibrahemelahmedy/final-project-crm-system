<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown by App\Models\AuditLog when anything attempts to update or delete an
 * audit row. Not an HTTP concern — no route exposes those verbs in the first
 * place; this is the second layer, for code paths inside the app.
 */
class AuditLogIsAppendOnly extends RuntimeException
{
    public function __construct(string $operation)
    {
        parent::__construct("The audit log is append-only; {$operation} is not permitted.");
    }
}
