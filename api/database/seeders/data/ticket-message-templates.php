<?php

/**
 * Story 21 (WIS-25) — the message template bank.
 *
 * Loaded with `require` (NOT autoloaded). Top level is the turn role; each role
 * maps to ['en' => [...variants], 'ar' => [...variants]]. `agent_question` and
 * `agent_resolution` are additionally keyed by ticket category first.
 *
 * Every string is real prose — no lorem, no Faker. The engine picks a variant
 * with a per-role running counter so consecutive tickets do not repeat.
 */

return [
    'agent_ack' => [
        'en' => [
            "Thanks for getting in touch. I have the details and I'm looking into it now - I'll come back to you shortly.",
            "Thanks for reporting this. I've picked up the ticket and I'm starting to investigate.",
            "Got it, thank you. I'm on this now and will update you as soon as I know more.",
            "Appreciate the detail in your message. I'm looking into it and will follow up soon.",
            "Thanks for flagging this. I've logged it and I'm checking what's happening on our side.",
            "Received, thank you. I'll take a look straight away and get back to you.",
        ],
        'ar' => [
            'شكرًا لتواصلك معنا. اطّلعت على التفاصيل وأنا أتابع الأمر الآن، وسأعود إليك قريبًا.',
            'شكرًا لإبلاغنا بهذا. استلمت التذكرة وبدأت في فحص المشكلة.',
            'تم الاستلام، شكرًا لك. أعمل على هذا الآن وسأوافيك بأي جديد فور معرفته.',
            'أقدّر التفاصيل الواردة في رسالتك. أتحقق من الأمر الآن وسأتابع معك قريبًا.',
            'شكرًا على الإشارة إلى هذا. سجّلت المشكلة وأتحقق مما يحدث من جانبنا.',
            'وصلني طلبك، شكرًا لك. سأطّلع على الأمر فورًا وأعود إليك.',
        ],
    ],

    'agent_question' => [
        'technical' => [
            'en' => [
                'Could you tell me roughly when this started, and whether it affects every user or only some accounts? A screenshot of the error would help too.',
                'Do you know if anything changed on your side around the time this began - a browser update, a new extension, a network change?',
                "Can you confirm which browser and version you're on, and whether it also happens in a private window?",
            ],
            'ar' => [
                'هل يمكنك إخباري تقريبًا متى بدأت المشكلة، وهل تؤثر على جميع المستخدمين أم على بعض الحسابات فقط؟ صورة للخطأ ستكون مفيدة أيضًا.',
                'هل تعلم إن كان قد تغيّر شيء من جانبكم وقت بدء المشكلة، مثل تحديث المتصفح أو إضافة جديدة أو تغيير في الشبكة؟',
                'هل يمكنك تأكيد المتصفح وإصداره، وهل تحدث المشكلة أيضًا في نافذة خاصة؟',
            ],
        ],
        'billing' => [
            'en' => [
                'Could you send me the invoice number and the last four digits of the card so I can match it to the transaction?',
                'Can you confirm the billing email on the account and the date you expected the charge or credit to appear?',
                'Which invoice period does this relate to, and do you have a reference number from your bank statement?',
            ],
            'ar' => [
                'هل يمكنك إرسال رقم الفاتورة وآخر أربعة أرقام من البطاقة حتى أتمكن من مطابقتها بالعملية؟',
                'هل يمكنك تأكيد البريد الإلكتروني للفوترة على الحساب والتاريخ الذي توقعت فيه ظهور الخصم أو المبلغ المسترد؟',
                'ما هي فترة الفاتورة المعنية، وهل لديك رقم مرجعي من كشف حساب البنك؟',
            ],
        ],
        'account' => [
            'en' => [
                'Could you confirm the exact email address on the account, and whether you sign in with a password or through single sign-on?',
                'To verify the request, can you tell me the company name on the account and roughly when it was created?',
                'Is this affecting one specific user or everyone on the workspace? Knowing that narrows it down.',
            ],
            'ar' => [
                'هل يمكنك تأكيد عنوان البريد الإلكتروني الدقيق على الحساب، وهل تسجّل الدخول بكلمة مرور أم عبر الدخول الموحّد؟',
                'للتحقق من الطلب، هل يمكنك إخباري باسم الشركة على الحساب وتاريخ إنشائه تقريبًا؟',
                'هل يؤثر هذا على مستخدم واحد محدد أم على الجميع في مساحة العمل؟ معرفة ذلك تضيّق نطاق البحث.',
            ],
        ],
        'general' => [
            'en' => [
                "Happy to help with this. Could you tell me a little more about what you're trying to achieve so I point you to the right place?",
                "Can you let me know which plan you're on and how many agents this would involve? That shapes the answer.",
                'Is there a deadline on your side we should work to? That helps me prioritise the reply.',
            ],
            'ar' => [
                'يسعدني المساعدة في هذا. هل يمكنك إخباري بمزيد من التفاصيل عمّا تحاول تحقيقه حتى أرشدك إلى المكان الصحيح؟',
                'هل يمكنك إخباري بالباقة المشترك بها وعدد الموظفين المعنيين؟ هذا يحدد الإجابة.',
                'هل هناك موعد نهائي من جانبكم ينبغي أن نلتزم به؟ هذا يساعدني في ترتيب أولوية الرد.',
            ],
        ],
        'feature_request' => [
            'en' => [
                "Thanks for the suggestion. Could you describe the workflow you'd want, step by step, so I can pass a clear picture to the product team?",
                'How often would your team use this, and what do you do today as a workaround?',
                "Would this need to work for every agent or just team leads? That detail matters for how it's built.",
            ],
            'ar' => [
                'شكرًا على الاقتراح. هل يمكنك وصف سير العمل الذي ترغب فيه خطوة بخطوة حتى أنقل صورة واضحة لفريق المنتج؟',
                'كم مرة سيستخدم فريقك هذه الميزة، وما الحل البديل الذي تتبعونه حاليًا؟',
                'هل يجب أن تعمل هذه الميزة لكل موظف أم لقادة الفرق فقط؟ هذه التفصيلة مهمة لطريقة بنائها.',
            ],
        ],
    ],

    'customer_followup' => [
        'en' => [
            "It started on Monday morning and it affects the whole team, not just my account. I've attached what I can see on my screen.",
            "Thanks for the quick reply. To answer your question - nothing changed on our side that we're aware of.",
            'Here are the details you asked for. Let me know if you need anything else to move this forward.',
            "I checked with the rest of the team and they're seeing the same thing. It's not just me.",
            "That's helpful, thank you. I've done what you suggested but the problem is still there.",
            'Sending the reference number now. It happened twice, both times in the afternoon.',
        ],
        'ar' => [
            'بدأت المشكلة صباح الاثنين وتؤثر على الفريق بأكمله وليس على حسابي فقط. أرفقت ما يظهر على شاشتي.',
            'شكرًا على الرد السريع. للإجابة على سؤالك، لم يتغيّر شيء من جانبنا على حد علمنا.',
            'هذه هي التفاصيل التي طلبتها. أخبرني إن كنت بحاجة إلى أي شيء آخر للمضي قدمًا.',
            'تحققت مع بقية الفريق ويواجهون نفس الأمر. المشكلة ليست عندي وحدي.',
            'هذا مفيد، شكرًا لك. نفّذت ما اقترحته لكن المشكلة لا تزال قائمة.',
            'أرسل رقم المرجع الآن. حدث الأمر مرتين، وفي المرتين بعد الظهر.',
        ],
    ],

    'agent_update' => [
        'en' => [
            "A quick update: I've reproduced this on our side and passed it to the platform team. I'll let you know as soon as there's a fix.",
            "We've found the cause and a fix is being prepared. I expect to have it deployed within the next day.",
            "Still working on this. The platform team is investigating and I'll update you the moment I hear back.",
            'Progress: the change has been made in our test environment and is being verified before it goes live.',
            "I don't have a resolution yet, but I wanted to let you know it's still actively being worked on.",
        ],
        'ar' => [
            'تحديث سريع: تمكّنت من إعادة إنتاج المشكلة لدينا وأحلتها إلى فريق المنصة، وسأعلمك فور توفر حل.',
            'وجدنا السبب ويجري إعداد حل. أتوقع نشره خلال اليوم التالي.',
            'لا نزال نعمل على هذا. يقوم فريق المنصة بالفحص وسأوافيك فور ورود رد.',
            'تقدّم في المتابعة: أُجري التعديل في بيئة الاختبار لدينا ويجري التحقق منه قبل نشره.',
            'ليس لديّ حل نهائي بعد، لكن أردت إعلامك بأن العمل عليه لا يزال جاريًا بفاعلية.',
        ],
    ],

    'customer_chase' => [
        'en' => [
            "Any news on this? It's starting to hold up our week.",
            'Just checking in - is there an update you can share?',
            "We're still seeing this. Could someone take a look today?",
            "Following up again as I haven't heard back. This is becoming urgent for us.",
        ],
        'ar' => [
            'هل من جديد بخصوص هذا الموضوع؟ بدأ الأمر يعطّل عملنا هذا الأسبوع.',
            'أتابع فقط، هل هناك تحديث يمكنك مشاركته؟',
            'لا نزال نواجه هذا. هل يمكن لأحد الاطلاع عليه اليوم؟',
            'أتابع مجددًا لأنني لم أتلقَّ ردًا. الأمر أصبح عاجلًا بالنسبة لنا.',
        ],
    ],

    'agent_pending' => [
        'en' => [
            "I need one more thing before I can go further: could you confirm the account email you're signing in with? I'll keep this ticket open on your side until then.",
            "To continue I'll need the invoice number and the approximate date. I've set the ticket to wait for your reply.",
            "Could you send a screenshot of the screen where this happens? I can't move forward without seeing it, so I'll pause here for your response.",
            "I've done what I can from our side. The next step needs confirmation from you - just reply here and I'll pick it straight back up.",
        ],
        'ar' => [
            'أحتاج إلى معلومة أخيرة قبل المتابعة: هل يمكنك تأكيد البريد الإلكتروني الذي تسجّل الدخول به؟ سأبقي التذكرة بانتظار ردك.',
            'للمتابعة سأحتاج إلى رقم الفاتورة والتاريخ التقريبي. ضبطت التذكرة لتنتظر ردك.',
            'هل يمكنك إرسال صورة للشاشة التي تظهر فيها المشكلة؟ لا يمكنني المتابعة دون رؤيتها، لذا سأتوقف هنا بانتظار ردك.',
            'أنجزت ما أستطيع من جانبنا. الخطوة التالية تحتاج تأكيدًا منك، فقط ردّ هنا وسأكمل فورًا.',
        ],
    ],

    'agent_resolution' => [
        'technical' => [
            'en' => [
                "This is fixed - the connector was re-authorised and mail has been flowing since this morning. Please confirm you're seeing new messages, and I'll close this off.",
                "The platform team deployed a fix earlier today and I've verified it on your workspace. Everything should be working normally now.",
                "Resolved: the cause was a stale token on our side, now refreshed. I've tested it end to end and it's behaving correctly.",
            ],
            'ar' => [
                'تم حل المشكلة - أُعيد تفويض الموصّل ووصلت الرسائل منذ هذا الصباح. يرجى التأكيد بأنك ترى الرسائل الجديدة وسأقوم بإغلاق التذكرة.',
                'نشر فريق المنصة إصلاحًا اليوم وتحققت منه على مساحة العمل الخاصة بكم. من المفترض أن يعمل كل شيء بشكل طبيعي الآن.',
                'تم الحل: كان السبب رمزًا منتهيًا من جانبنا وقد تم تحديثه. اختبرت الأمر من البداية إلى النهاية وهو يعمل بشكل صحيح.',
            ],
        ],
        'billing' => [
            'en' => [
                'The duplicate charge has been refunded and should reach the card within five working days. A corrected invoice is attached.',
                "I've applied the credit to your account and it will show on the next invoice. Let me know if the amount doesn't match what you expected.",
                'The billing profile has been updated and reissued invoices are on their way to your finance address now.',
            ],
            'ar' => [
                'تمت إعادة المبلغ المكرر وسيصل إلى البطاقة خلال خمسة أيام عمل. الفاتورة المصححة مرفقة.',
                'أضفت المبلغ الدائن إلى حسابك وسيظهر في الفاتورة التالية. أخبرني إن كان المبلغ لا يطابق ما توقعته.',
                'تم تحديث ملف الفوترة والفواتير المعاد إصدارها في طريقها الآن إلى عنوان قسم المالية لديكم.',
            ],
        ],
        'account' => [
            'en' => [
                "Your account is unlocked and I've cleared the failed sign-in count. You should be able to log in normally now.",
                "The role has been restored and I've confirmed the user can manage the workspace again. Please check on your side.",
                'The email change is done and verified. The old address no longer has access and the new one is now primary.',
            ],
            'ar' => [
                'تم فتح قفل حسابك ومسحت عدّاد محاولات الدخول الفاشلة. من المفترض أن تتمكن من تسجيل الدخول بشكل طبيعي الآن.',
                'تمت استعادة الصلاحية وتأكدت من أن المستخدم يستطيع إدارة مساحة العمل مجددًا. يرجى التحقق من جانبكم.',
                'تم تغيير البريد الإلكتروني والتحقق منه. العنوان القديم لم يعد لديه صلاحية والعنوان الجديد أصبح الأساسي.',
            ],
        ],
        'general' => [
            'en' => [
                "I've sent the document to the email on your account and added a link in the help centre for future reference.",
                "That's all set up now. I've included a short summary above so your team has it in writing.",
                'Answered in full above - the short version is yes, and the setting is under Organisation Settings. Reach out any time if anything is unclear.',
            ],
            'ar' => [
                'أرسلت المستند إلى البريد المسجّل على حسابك وأضفت رابطًا في مركز المساعدة للرجوع إليه لاحقًا.',
                'تم إعداد كل شيء الآن. أدرجت ملخصًا قصيرًا أعلاه ليكون لدى فريقكم مكتوبًا.',
                'تمت الإجابة بالكامل أعلاه - باختصار نعم، والإعداد موجود ضمن إعدادات المؤسسة. تواصل معنا في أي وقت إذا كان هناك ما هو غير واضح.',
            ],
        ],
        'feature_request' => [
            'en' => [
                "I've logged this as a feature request with the product team and linked your ticket so you'll be notified if it ships. Closing this for now.",
                "Good news - a version of this is already planned. I've added your details to the request so you're on the list to hear when it's available.",
                "Thanks again for the idea. It's recorded on the roadmap backlog; I'll close the ticket but the request stays tracked.",
            ],
            'ar' => [
                'سجّلت هذا كطلب ميزة لدى فريق المنتج وربطت تذكرتك حتى يتم إعلامك إن تم إطلاقها. سأغلق التذكرة الآن.',
                'خبر جيد - هناك نسخة من هذه الميزة مخطط لها بالفعل. أضفت بياناتك إلى الطلب لتكون ضمن قائمة من سيُبلَّغ عند توفرها.',
                'شكرًا مجددًا على الفكرة. تم تسجيلها في قائمة خطة التطوير؛ سأغلق التذكرة لكن الطلب يبقى متابَعًا.',
            ],
        ],
    ],

    'customer_thanks' => [
        'en' => [
            'Confirmed, everything is working again. Thanks for the quick turnaround.',
            "That's sorted it. Appreciate the help.",
            'Looks good on our side now. Thank you for staying on it.',
            'Perfect, thanks. You can close the ticket.',
        ],
        'ar' => [
            'تم التأكد، كل شيء يعمل مجددًا. شكرًا على سرعة الاستجابة.',
            'هذا حلّ المشكلة. أقدّر المساعدة.',
            'يبدو كل شيء سليمًا من جانبنا الآن. شكرًا على المتابعة.',
            'ممتاز، شكرًا لك. يمكنك إغلاق التذكرة.',
        ],
    ],

    'internal_note' => [
        'en' => [
            'Noting for the team: this is the third report of the same connector fault this month. Flagged to platform.',
            'Internal: customer is on the Enterprise plan, keep response times tight on this one.',
            'For the record - platform team aware, tracking under their incident. No action needed from us until they update.',
            'Heads up: similar ticket last week from another customer in the same region. Might be regional.',
        ],
        'ar' => [
            'للتوثيق للفريق: هذه ثالث حالة لنفس عطل الموصّل هذا الشهر. تم إبلاغ فريق المنصة.',
            'ملاحظة داخلية: العميل على الباقة المؤسسية، حافظوا على أوقات استجابة سريعة في هذه التذكرة.',
            'للتسجيل - فريق المنصة على علم ويتابع الأمر ضمن حادثة لديهم. لا إجراء مطلوب منّا حتى يوافونا بجديد.',
            'تنبيه: وردت تذكرة مشابهة الأسبوع الماضي من عميل آخر في نفس المنطقة. قد تكون المشكلة إقليمية.',
        ],
    ],
];
