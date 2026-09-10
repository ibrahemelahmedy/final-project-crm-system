<?php

return [
    'priority' => [
        'low' => 'منخفضة',
        'normal' => 'عادية',
        'high' => 'مرتفعة',
        'urgent' => 'عاجلة',
    ],

    'ticket_status' => [
        'open' => 'مفتوحة',
        'pending' => 'معلّقة',
        'resolved' => 'محلولة',
        'closed' => 'مغلقة',
    ],

    'channel' => [
        'email' => 'البريد الإلكتروني',
        'whatsapp' => 'واتساب',
        'chat' => 'محادثة مباشرة',
        'sms' => 'رسالة نصية',
        'web_form' => 'نموذج ويب',
    ],

    'user_role' => [
        'agent' => 'موظف دعم',
        'team_lead' => 'قائد فريق',
        'administrator' => 'مدير النظام',
    ],

    'customer_tier' => [
        'standard' => 'عادي',
        'premium' => 'مميّز',
        'enterprise' => 'مؤسسي',
    ],

    'article_status' => [
        'draft' => 'مسودة',
        'published' => 'منشورة',
        'archived' => 'مؤرشفة',
    ],

    'notification_type' => [
        'sla_at_risk' => 'اتفاقية الخدمة معرّضة للخطر',
        'sla_breached' => 'خرق اتفاقية الخدمة',
        'mention' => 'إشارة',
        'task_due' => 'مهمة مستحقة',
        'customer_replied' => 'ردّ العميل',
    ],

    'quick_reply_status' => [
        'active' => 'نشط',
        'archived' => 'مؤرشف',
    ],

    'task_status' => [
        'open' => 'مفتوحة',
        'completed' => 'مكتملة',
        'cancelled' => 'ملغاة',
    ],

    'message_visibility' => [
        'public' => 'رد على العميل',
        'internal' => 'ملاحظة داخلية',
    ],

    'category' => [
        'general' => 'عام',
        'billing' => 'الفوترة',
        'technical' => 'تقني',
        'account' => 'الحساب',
        'feature_request' => 'طلب ميزة',
    ],
];
