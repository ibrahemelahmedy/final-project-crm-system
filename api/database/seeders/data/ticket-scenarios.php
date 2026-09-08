<?php

/**
 * Story 21 (WIS-25) — the authored scenario pool.
 *
 * A plain list of 40 support scenarios, loaded with `require` (NOT autoloaded).
 * Every row carries both an English and an Arabic subject and opening message;
 * `lang` picks which pair the seeded ticket actually uses. `category` is one of
 * App\Models\Ticket::CATEGORIES. `key` is a stable id the schedule references.
 *
 * 13 rows are seeded in Arabic (lang => 'ar'), 27 in English. No lorem: every
 * string is real customer prose.
 */

return [
    // ---- technical -------------------------------------------------------
    [
        'key' => 'tech-01', 'category' => 'technical', 'lang' => 'en',
        'subject_en' => 'Email integration stopped syncing after the weekend',
        'subject_ar' => 'توقف تكامل البريد الإلكتروني عن المزامنة بعد عطلة نهاية الأسبوع',
        'opening_en' => 'Our inbox stopped pulling new mail some time on Saturday. Nothing has come through since, and sending still works. Can you check the connection on your side?',
        'opening_ar' => 'توقف صندوق الوارد لدينا عن سحب الرسائل الجديدة يوم السبت. لم يصلنا أي شيء منذ ذلك الحين، بينما لا تزال عملية الإرسال تعمل. هل يمكنكم التحقق من الاتصال من جانبكم؟',
    ],
    [
        'key' => 'tech-02', 'category' => 'technical', 'lang' => 'ar',
        'subject_en' => 'WhatsApp messages are not reaching the inbox',
        'subject_ar' => 'رسائل واتساب لا تصل إلى صندوق الوارد',
        'opening_en' => 'Customers tell us they have replied on WhatsApp but the messages never show up in the ticket. It has been happening since yesterday afternoon.',
        'opening_ar' => 'يخبرنا العملاء بأنهم ردّوا عبر واتساب لكن الرسائل لا تظهر في التذكرة إطلاقًا. المشكلة قائمة منذ بعد ظهر أمس.',
    ],
    [
        'key' => 'tech-03', 'category' => 'technical', 'lang' => 'en',
        'subject_en' => 'Attachments over 5 MB fail to upload',
        'subject_ar' => 'فشل رفع المرفقات التي يزيد حجمها عن 5 ميجابايت',
        'opening_en' => 'Whenever an agent tries to attach a file larger than about 5 MB the upload spins for a while and then fails without a message. Smaller files are fine.',
        'opening_ar' => 'عندما يحاول أحد الموظفين إرفاق ملف يزيد حجمه عن خمسة ميجابايت تستمر عملية الرفع ثم تفشل دون أي رسالة. الملفات الأصغر تعمل دون مشكلة.',
    ],
    [
        'key' => 'tech-04', 'category' => 'technical', 'lang' => 'en',
        'subject_en' => 'Webhook deliveries have returned 500 since Tuesday',
        'subject_ar' => 'إرسال الـ webhook يعيد الخطأ 500 منذ يوم الثلاثاء',
        'opening_en' => 'Our endpoint has been receiving 500 responses from your webhook calls since Tuesday. Our side has not changed and the logs show the payload never arrives complete.',
        'opening_ar' => 'تتلقى نقطة النهاية لدينا استجابات بالخطأ 500 من طلبات الـ webhook منذ يوم الثلاثاء. لم يتغير شيء من جانبنا وتظهر السجلات أن البيانات لا تصل كاملة.',
    ],
    [
        'key' => 'tech-05', 'category' => 'technical', 'lang' => 'ar',
        'subject_en' => 'The ticket list takes over 30 seconds to load',
        'subject_ar' => 'بطء شديد في تحميل قائمة التذاكر',
        'opening_en' => 'The ticket queue has become very slow this week - it often takes more than half a minute to open. The rest of the app feels normal.',
        'opening_ar' => 'أصبح تحميل قائمة التذاكر بطيئًا جدًا هذا الأسبوع، وغالبًا ما يستغرق أكثر من نصف دقيقة. باقي أجزاء التطبيق تعمل بشكل طبيعي.',
    ],
    [
        'key' => 'tech-06', 'category' => 'technical', 'lang' => 'en',
        'subject_en' => 'SSO login loops back to the sign-in page',
        'subject_ar' => 'تسجيل الدخول الموحّد يعيدني إلى صفحة الدخول',
        'opening_en' => 'After I authenticate with our identity provider I get sent straight back to your sign-in screen instead of the dashboard. It affects everyone on the team.',
        'opening_ar' => 'بعد المصادقة عبر مزوّد الهوية لدينا يعيدني النظام مباشرة إلى شاشة تسجيل الدخول بدلًا من لوحة التحكم. المشكلة تؤثر على جميع أفراد الفريق.',
    ],
    [
        'key' => 'tech-07', 'category' => 'technical', 'lang' => 'en',
        'subject_en' => 'Mobile app crashes when opening a ticket thread',
        'subject_ar' => 'تطبيق الجوال يتوقف عند فتح محادثة التذكرة',
        'opening_en' => 'The iOS app closes itself every time I tap into a ticket conversation. The list view works, but opening any thread crashes it immediately.',
        'opening_ar' => 'يغلق تطبيق iOS نفسه في كل مرة أفتح فيها محادثة تذكرة. عرض القائمة يعمل، لكن فتح أي محادثة يوقفه فورًا.',
    ],
    [
        'key' => 'tech-08', 'category' => 'technical', 'lang' => 'ar',
        'subject_en' => 'Reports show empty data after the latest update',
        'subject_ar' => 'التقارير تظهر بيانات فارغة بعد التحديث الأخير',
        'opening_en' => 'Since the update last week every chart on the Reports page shows nothing, even though we clearly have resolved tickets in that period.',
        'opening_ar' => 'منذ تحديث الأسبوع الماضي تظهر جميع الرسوم البيانية في صفحة التقارير فارغة، رغم أن لدينا تذاكر تم حلّها في تلك الفترة.',
    ],
    [
        'key' => 'tech-09', 'category' => 'technical', 'lang' => 'en',
        'subject_en' => 'Search returns no results for Arabic customer names',
        'subject_ar' => 'البحث لا يعيد أي نتائج لأسماء العملاء بالعربية',
        'opening_en' => 'Searching for a customer by their Arabic name returns nothing, even for customers we know are in the system. The English names work fine.',
        'opening_ar' => 'البحث عن عميل باسمه العربي لا يعيد أي نتيجة، حتى لعملاء نعرف أنهم مسجّلون في النظام. الأسماء الإنجليزية تعمل بشكل سليم.',
    ],
    [
        'key' => 'tech-10', 'category' => 'technical', 'lang' => 'en',
        'subject_en' => 'Notification emails land in the spam folder',
        'subject_ar' => 'رسائل الإشعارات تصل إلى مجلد البريد غير المرغوب',
        'opening_en' => 'All of our assignment and SLA notification emails are being filed as spam by our mail provider. Is there an SPF or DKIM setting we should apply?',
        'opening_ar' => 'جميع رسائل الإشعارات الخاصة بالإسناد واتفاقية مستوى الخدمة يصنّفها مزوّد البريد لدينا كرسائل غير مرغوبة. هل هناك إعداد SPF أو DKIM ينبغي تطبيقه؟',
    ],
    [
        'key' => 'tech-11', 'category' => 'technical', 'lang' => 'ar',
        'subject_en' => 'Report export to Excel fails silently',
        'subject_ar' => 'لا يمكن تصدير التقرير إلى ملف Excel',
        'opening_en' => 'When I click Export on the Reports page nothing downloads and there is no error. It used to produce an Excel file straight away.',
        'opening_ar' => 'عند الضغط على زر التصدير في صفحة التقارير لا يتم تنزيل أي ملف ولا تظهر أي رسالة خطأ. كان النظام سابقًا ينتج ملف Excel مباشرة.',
    ],
    [
        'key' => 'tech-12', 'category' => 'technical', 'lang' => 'en',
        'subject_en' => 'API rate limit is hit during the nightly sync',
        'subject_ar' => 'تجاوز حد الطلبات على الـ API أثناء المزامنة الليلية',
        'opening_en' => 'Our nightly sync job started hitting your rate limit about a week ago and now fails halfway through. Nothing changed in our job - did the limits move?',
        'opening_ar' => 'بدأت مهمة المزامنة الليلية لدينا في تجاوز حد الطلبات قبل نحو أسبوع، وهي الآن تفشل في منتصفها. لم يتغير شيء في المهمة لدينا، فهل تغيّرت الحدود؟',
    ],

    // ---- billing --------------------------------------------------------
    [
        'key' => 'bill-01', 'category' => 'billing', 'lang' => 'en',
        'subject_en' => 'Invoice charged twice for the March subscription',
        'subject_ar' => 'تم خصم فاتورة اشتراك مارس مرتين',
        'opening_en' => 'We were charged twice for the March subscription on the same card, two days apart. The second charge has cleared. Could you confirm and refund the duplicate?',
        'opening_ar' => 'تم خصم اشتراك مارس مرتين من نفس البطاقة بفارق يومين. الخصم الثاني تمت معالجته بالفعل. هل يمكنكم التأكد واسترجاع المبلغ المكرر؟',
    ],
    [
        'key' => 'bill-02', 'category' => 'billing', 'lang' => 'ar',
        'subject_en' => 'Request to upgrade the subscription to Enterprise',
        'subject_ar' => 'طلب ترقية الاشتراك إلى الباقة المؤسسية',
        'opening_en' => 'We would like to move from the current plan to Enterprise before the next renewal. Could you send the pricing and what changes on our account?',
        'opening_ar' => 'نرغب في الانتقال من الباقة الحالية إلى الباقة المؤسسية قبل التجديد القادم. هل يمكنكم إرسال الأسعار وما الذي سيتغيّر في حسابنا؟',
    ],
    [
        'key' => 'bill-03', 'category' => 'billing', 'lang' => 'en',
        'subject_en' => 'VAT number missing from the last three invoices',
        'subject_ar' => 'الرقم الضريبي غير مذكور في آخر ثلاث فواتير',
        'opening_en' => 'Our finance team needs the company VAT number printed on every invoice. It is missing from the last three. Can these be reissued?',
        'opening_ar' => 'يحتاج فريق المالية لدينا إلى طباعة الرقم الضريبي للشركة على كل فاتورة. وهو غير موجود في آخر ثلاث فواتير. هل يمكن إعادة إصدارها؟',
    ],
    [
        'key' => 'bill-04', 'category' => 'billing', 'lang' => 'en',
        'subject_en' => 'Refund not received ten days after cancellation',
        'subject_ar' => 'لم يصل المبلغ المسترد بعد عشرة أيام من الإلغاء',
        'opening_en' => 'We cancelled ten days ago and were told a partial refund would follow within five working days. It has not arrived and the account still shows a balance.',
        'opening_ar' => 'قمنا بالإلغاء قبل عشرة أيام وأُبلغنا بأن مبلغًا مستردًا جزئيًا سيصل خلال خمسة أيام عمل. لم يصل المبلغ ولا يزال الحساب يظهر رصيدًا.',
    ],
    [
        'key' => 'bill-05', 'category' => 'billing', 'lang' => 'ar',
        'subject_en' => 'Card payment failed at renewal',
        'subject_ar' => 'فشل الدفع بالبطاقة الائتمانية عند التجديد',
        'opening_en' => 'Our renewal payment failed this morning even though the card is valid and has funds. We do not want a service interruption - how do we retry it?',
        'opening_ar' => 'فشلت عملية دفع التجديد هذا الصباح رغم أن البطاقة سارية وبها رصيد كافٍ. لا نريد انقطاع الخدمة، فكيف نعيد المحاولة؟',
    ],
    [
        'key' => 'bill-06', 'category' => 'billing', 'lang' => 'en',
        'subject_en' => 'Seat count on the invoice does not match our team size',
        'subject_ar' => 'عدد المستخدمين في الفاتورة لا يطابق حجم فريقنا',
        'opening_en' => "This month's invoice bills us for 18 seats but we only have 14 active agents. Could you check where the extra four are coming from?",
        'opening_ar' => 'تحاسبنا فاتورة هذا الشهر على 18 مستخدمًا بينما لدينا 14 موظفًا نشطًا فقط. هل يمكنكم التحقق من مصدر الأربعة الإضافيين؟',
    ],
    [
        'key' => 'bill-07', 'category' => 'billing', 'lang' => 'en',
        'subject_en' => 'Purchase order number needs to appear on invoices',
        'subject_ar' => 'يجب إظهار رقم أمر الشراء على الفواتير',
        'opening_en' => 'Our procurement process requires our PO number on every invoice you send us. Can this be added to the billing profile so it appears automatically?',
        'opening_ar' => 'تتطلب إجراءات المشتريات لدينا إظهار رقم أمر الشراء على كل فاتورة ترسلونها. هل يمكن إضافته إلى ملف الفوترة ليظهر تلقائيًا؟',
    ],
    [
        'key' => 'bill-08', 'category' => 'billing', 'lang' => 'ar',
        'subject_en' => 'Question about an extra charge on the August invoice',
        'subject_ar' => 'استفسار عن رسوم إضافية في فاتورة أغسطس',
        'opening_en' => 'There is a line on the August invoice we do not recognise, about 40 currency units. Could you tell us what it is for?',
        'opening_ar' => 'يوجد بند في فاتورة أغسطس لا نعرفه بقيمة نحو 40 وحدة. هل يمكنكم إخبارنا بسبب هذه الرسوم؟',
    ],

    // ---- account -------------------------------------------------------
    [
        'key' => 'acct-01', 'category' => 'account', 'lang' => 'en',
        'subject_en' => 'Password reset email never arrives',
        'subject_ar' => 'رسالة إعادة تعيين كلمة المرور لا تصل',
        'opening_en' => 'I have requested a password reset four times today and none of the emails have arrived. I have checked spam. My address is correct on the account.',
        'opening_ar' => 'طلبت إعادة تعيين كلمة المرور أربع مرات اليوم ولم تصلني أي رسالة. تحققت من مجلد الرسائل غير المرغوبة. بريدي صحيح في الحساب.',
    ],
    [
        'key' => 'acct-02', 'category' => 'account', 'lang' => 'en',
        'subject_en' => 'Locked out after too many failed sign-in attempts',
        'subject_ar' => 'تم قفل الحساب بعد محاولات دخول فاشلة متكررة',
        'opening_en' => 'My account is locked after I mistyped my password a few times. The screen says to try again later but it has been an hour. Can you unlock it?',
        'opening_ar' => 'تم قفل حسابي بعد أن أخطأت في كتابة كلمة المرور عدة مرات. تقول الشاشة أن أحاول لاحقًا لكن مضت ساعة. هل يمكنكم فتح القفل؟',
    ],
    [
        'key' => 'acct-03', 'category' => 'account', 'lang' => 'ar',
        'subject_en' => 'Request to change the primary account email',
        'subject_ar' => 'طلب تغيير البريد الإلكتروني للحساب الرئيسي',
        'opening_en' => 'We need to change the primary email on the account from a personal address to our shared support mailbox. What do you need from us to do this safely?',
        'opening_ar' => 'نحتاج إلى تغيير البريد الرئيسي للحساب من عنوان شخصي إلى صندوق الدعم المشترك لدينا. ما الذي تحتاجونه منّا لإتمام ذلك بأمان؟',
    ],
    [
        'key' => 'acct-04', 'category' => 'account', 'lang' => 'en',
        'subject_en' => 'New agent cannot see the team queue',
        'subject_ar' => 'الموظف الجديد لا يرى قائمة تذاكر الفريق',
        'opening_en' => 'We added a new agent yesterday. They can log in but only see tickets assigned to them, not the whole team queue like the others. What controls that?',
        'opening_ar' => 'أضفنا موظفًا جديدًا أمس. يستطيع تسجيل الدخول لكنه يرى فقط التذاكر المسندة إليه، وليس قائمة الفريق كاملة مثل البقية. ما الذي يتحكم في ذلك؟',
    ],
    [
        'key' => 'acct-05', 'category' => 'account', 'lang' => 'en',
        'subject_en' => 'Two-factor codes are rejected as invalid',
        'subject_ar' => 'رموز التحقق بخطوتين تُرفض باعتبارها غير صحيحة',
        'opening_en' => 'My authenticator app codes are being rejected as invalid since this morning. The phone clock is correct. I have one login working and do not want to lose it.',
        'opening_ar' => 'تُرفض رموز تطبيق المصادقة لدي باعتبارها غير صحيحة منذ هذا الصباح. ساعة الهاتف مضبوطة. لدي جلسة دخول واحدة تعمل ولا أريد فقدانها.',
    ],
    [
        'key' => 'acct-06', 'category' => 'account', 'lang' => 'ar',
        'subject_en' => 'Deactivate the account of an employee who left',
        'subject_ar' => 'إلغاء تفعيل حساب موظف غادر الشركة',
        'opening_en' => 'One of our agents left the company last week. Please deactivate their access and let us know if their assigned tickets need to be reassigned first.',
        'opening_ar' => 'غادر أحد موظفينا الشركة الأسبوع الماضي. يرجى إلغاء تفعيل صلاحيته وإخبارنا إن كان يجب إعادة إسناد تذاكره أولًا.',
    ],
    [
        'key' => 'acct-07', 'category' => 'account', 'lang' => 'en',
        'subject_en' => 'Admin role was removed by mistake',
        'subject_ar' => 'تم سحب صلاحية المدير عن طريق الخطأ',
        'opening_en' => 'While tidying up roles we accidentally removed admin from our only administrator. Now nobody can manage users. Can you restore it on our behalf?',
        'opening_ar' => 'أثناء ترتيب الصلاحيات أزلنا عن طريق الخطأ صلاحية المدير عن المسؤول الوحيد لدينا. الآن لا يستطيع أحد إدارة المستخدمين. هل يمكنكم استعادتها نيابة عنّا؟',
    ],
    [
        'key' => 'acct-08', 'category' => 'account', 'lang' => 'en',
        'subject_en' => 'Company name is spelled incorrectly on the profile',
        'subject_ar' => 'اسم الشركة مكتوب بشكل خاطئ في الملف التعريفي',
        'opening_en' => 'Our company name is misspelled on the workspace profile and it shows up on the customer portal. Could you correct it to the spelling in my signature?',
        'opening_ar' => 'اسم شركتنا مكتوب بشكل خاطئ في ملف مساحة العمل ويظهر كذلك في بوابة العملاء. هل يمكنكم تصحيحه ليطابق التوقيع في رسالتي؟',
    ],

    // ---- general ------------------------------------------------------
    [
        'key' => 'gen-01', 'category' => 'general', 'lang' => 'en',
        'subject_en' => 'How do I add a second branch to our workspace?',
        'subject_ar' => 'كيف أضيف فرعًا ثانيًا إلى مساحة العمل؟',
        'opening_en' => 'We are opening a second office and want its agents grouped separately in reports. Is there a branch feature for that, and where do I set it up?',
        'opening_ar' => 'نفتتح مكتبًا ثانيًا ونريد تجميع موظفيه بشكل منفصل في التقارير. هل توجد ميزة للفروع لهذا الغرض، وأين أقوم بإعدادها؟',
    ],
    [
        'key' => 'gen-02', 'category' => 'general', 'lang' => 'ar',
        'subject_en' => "What are the support team's working hours?",
        'subject_ar' => 'ما هي ساعات عمل فريق الدعم؟',
        'opening_en' => 'Could you tell me the hours your support team is available, and whether SLA timers pause outside those hours?',
        'opening_ar' => 'هل يمكنكم إخباري بساعات توفر فريق الدعم لديكم، وهل تتوقف مؤقتات اتفاقية مستوى الخدمة خارج تلك الساعات؟',
    ],
    [
        'key' => 'gen-03', 'category' => 'general', 'lang' => 'en',
        'subject_en' => 'Onboarding session request for five new agents',
        'subject_ar' => 'طلب جلسة تعريفية لخمسة موظفين جدد',
        'opening_en' => 'We have five new agents starting next month and would like a walkthrough session covering the queue, replies and SLAs. What dates do you have?',
        'opening_ar' => 'لدينا خمسة موظفين جدد يبدأون الشهر القادم ونرغب في جلسة تعريفية تغطي قائمة التذاكر والردود واتفاقيات مستوى الخدمة. ما المواعيد المتاحة لديكم؟',
    ],
    [
        'key' => 'gen-04', 'category' => 'general', 'lang' => 'en',
        'subject_en' => 'Where can I find the data retention policy?',
        'subject_ar' => 'أين أجد سياسة الاحتفاظ بالبيانات؟',
        'opening_en' => 'Our security review needs your data retention policy - how long closed tickets and attachments are kept. Is there a document I can share with them?',
        'opening_ar' => 'تحتاج مراجعتنا الأمنية إلى سياسة الاحتفاظ بالبيانات لديكم، أي المدة التي تُحفظ فيها التذاكر المغلقة والمرفقات. هل يوجد مستند يمكنني مشاركته معهم؟',
    ],
    [
        'key' => 'gen-05', 'category' => 'general', 'lang' => 'ar',
        'subject_en' => 'Request a copy of the SLA agreement',
        'subject_ar' => 'طلب نسخة من اتفاقية مستوى الخدمة',
        'opening_en' => 'Could you send us a current copy of our SLA agreement? Our records are from the original sign-up and may be out of date.',
        'opening_ar' => 'هل يمكنكم إرسال نسخة حديثة من اتفاقية مستوى الخدمة الخاصة بنا؟ النسخة لدينا تعود إلى وقت الاشتراك الأول وقد تكون قديمة.',
    ],
    [
        'key' => 'gen-06', 'category' => 'general', 'lang' => 'en',
        'subject_en' => 'Moving our workspace to a different time zone',
        'subject_ar' => 'نقل مساحة العمل إلى منطقة زمنية أخرى',
        'opening_en' => 'Our team has relocated and we need the workspace time zone changed so that reports and SLA hours line up with our new working day.',
        'opening_ar' => 'انتقل فريقنا ونحتاج إلى تغيير المنطقة الزمنية لمساحة العمل بحيث تتوافق التقارير وساعات اتفاقية مستوى الخدمة مع يوم عملنا الجديد.',
    ],

    // ---- feature_request --------------------------------------------
    [
        'key' => 'feat-01', 'category' => 'feature_request', 'lang' => 'en',
        'subject_en' => 'Export the ticket queue to CSV',
        'subject_ar' => 'تصدير قائمة التذاكر إلى ملف CSV',
        'opening_en' => 'It would help us a lot to export the filtered ticket queue to CSV for our weekly review. Is that on the roadmap, or is there a workaround today?',
        'opening_ar' => 'سيساعدنا كثيرًا تصدير قائمة التذاكر المُصفّاة إلى ملف CSV لمراجعتنا الأسبوعية. هل هذا مدرج في خطة التطوير، أم يوجد حل بديل حاليًا؟',
    ],
    [
        'key' => 'feat-02', 'category' => 'feature_request', 'lang' => 'ar',
        'subject_en' => 'Add push notifications on mobile',
        'subject_ar' => 'إضافة إشعارات فورية على الهاتف المحمول',
        'opening_en' => 'The mobile app only updates when I open it. Push notifications for new assignments and SLA warnings would make it far more useful on the go.',
        'opening_ar' => 'لا يُحدّث تطبيق الهاتف المحتوى إلا عند فتحه. إضافة إشعارات فورية للإسنادات الجديدة وتحذيرات اتفاقية مستوى الخدمة ستجعله أكثر فائدة أثناء التنقل.',
    ],
    [
        'key' => 'feat-03', 'category' => 'feature_request', 'lang' => 'en',
        'subject_en' => 'Bulk reassign tickets between agents',
        'subject_ar' => 'إعادة إسناد التذاكر بالجملة بين الموظفين',
        'opening_en' => 'When an agent is out we have to reassign their tickets one by one. A way to select many and reassign them all at once would save a lot of time.',
        'opening_ar' => 'عندما يكون أحد الموظفين غائبًا نضطر إلى إعادة إسناد تذاكره واحدة تلو الأخرى. وجود طريقة لتحديد عدة تذاكر وإعادة إسنادها دفعة واحدة سيوفّر وقتًا كبيرًا.',
    ],
    [
        'key' => 'feat-04', 'category' => 'feature_request', 'lang' => 'en',
        'subject_en' => 'Saved filter views on the ticket queue',
        'subject_ar' => 'حفظ طرق عرض التصفية في قائمة التذاكر',
        'opening_en' => 'Each of us rebuilds the same filter combination every morning. Being able to save a named view and switch between views would be a big help.',
        'opening_ar' => 'يعيد كل منّا بناء نفس مجموعة عوامل التصفية كل صباح. القدرة على حفظ عرض باسم محدد والتبديل بين العروض ستكون مفيدة جدًا.',
    ],
    [
        'key' => 'feat-05', 'category' => 'feature_request', 'lang' => 'ar',
        'subject_en' => 'Arabic support for saved quick replies',
        'subject_ar' => 'دعم الردود الجاهزة باللغة العربية',
        'opening_en' => 'Our quick replies in Arabic lose their formatting and sometimes the direction flips. Could quick replies handle Arabic text properly?',
        'opening_ar' => 'تفقد ردودنا الجاهزة بالعربية تنسيقها وأحيانًا ينعكس اتجاه النص. هل يمكن أن تتعامل الردود الجاهزة مع النص العربي بشكل صحيح؟',
    ],
    [
        'key' => 'feat-06', 'category' => 'feature_request', 'lang' => 'en',
        'subject_en' => 'Dark mode for the customer portal',
        'subject_ar' => 'الوضع الداكن لبوابة العملاء',
        'opening_en' => 'The agent app has a dark theme but the customer portal does not. Several of our customers have asked for one. Any plans to add it?',
        'opening_ar' => 'يحتوي تطبيق الموظفين على سمة داكنة لكن بوابة العملاء لا. طلب عدد من عملائنا هذه الميزة. هل هناك خطط لإضافتها؟',
    ],
];
