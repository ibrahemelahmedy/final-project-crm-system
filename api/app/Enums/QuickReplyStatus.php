<?php

namespace App\Enums;

enum QuickReplyStatus: string
{
    case Active = 'active';
    case Archived = 'archived';

    public function label(): string
    {
        return __('enums.quick_reply_status.'.$this->value);
    }
}
