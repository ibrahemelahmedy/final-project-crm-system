<?php

namespace App\Enums;

enum TaskStatus: string
{
    case Open = 'open';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return __('enums.task_status.'.$this->value);
    }
}
