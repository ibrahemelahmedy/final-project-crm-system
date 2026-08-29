// Story 13 (CSAT Collection) — the two-locale string module for the PUBLIC
// feedback page.
//
// >>> Story 15 (i18n) absorbs this module into the shared catalogue. When it
// does, it MUST keep the browser-detection rule below: there is no signed-in
// user and no customer locale field anywhere in the MVP, so the page cannot
// fall back to a per-user server preference. Detection + an explicit on-page
// toggle is the whole contract. <<<

export type CsatLocale = 'en' | 'ar';

export type CsatStrings = {
  brand: string;
  heading: string;
  requestLabel: (number: string, subject: string) => string;
  ratingLegend: string;
  ratingGroupLabel: string;
  ratingOptions: [string, string, string, string, string];
  ratingEmojis: [string, string, string, string, string];
  ratingSelected: (label: string) => string;
  commentLabel: string;
  commentOptional: string;
  commentHint: string;
  commentPlaceholder: string;
  submit: string;
  submitting: string;
  submittedTitle: string;
  submittedBody: (number: string) => string;
  answeredTitle: string;
  yourResponse: string;
  commentHeading: string;
  submittedOn: (date: string) => string;
  answeredFooter: string;
  expiredTitle: string;
  expiredBody: string;
  errorTitle: string;
  errorBody: string;
  retry: string;
  loading: string;
  toggleTo: string;
};

const en: CsatStrings = {
  brand: 'Wisal',
  heading: 'How did we do?',
  requestLabel: (number, subject) => `Request ${number} · "${subject}"`,
  ratingLegend: 'Your rating',
  ratingGroupLabel: 'Rate your support experience from 1 to 5',
  ratingOptions: ['1 – Poor', '2 – Fair', '3 – Okay', '4 – Good', '5 – Great'],
  ratingEmojis: ['😞', '😐', '🙂', '😊', '🤩'],
  ratingSelected: (label) => `${label} selected`,
  commentLabel: 'Comment',
  commentOptional: '(optional)',
  commentHint: 'Any detail helps us improve — a single word is fine.',
  commentPlaceholder: 'Tell us what went well or what could be better…',
  submit: 'Submit feedback',
  submitting: 'Submitting…',
  submittedTitle: 'Thank you for your feedback',
  submittedBody: (number) =>
    `Your response for request ${number} has been recorded. It helps us keep improving.`,
  answeredTitle: "You've already responded",
  yourResponse: 'YOUR RESPONSE',
  commentHeading: 'COMMENT',
  submittedOn: (date) => `Submitted ${date}`,
  answeredFooter: 'Your response has been recorded. Thank you.',
  expiredTitle: 'This link is no longer active',
  expiredBody:
    'Feedback links expire after 30 days. This one has passed that window — no action needed.',
  errorTitle: "We couldn't load this page",
  errorBody: 'Check your connection and try again.',
  retry: 'Retry',
  loading: 'Loading…',
  toggleTo: 'العربية',
};

const ar: CsatStrings = {
  brand: 'وِصال',
  heading: 'كيف كان أداؤنا؟',
  requestLabel: (number, subject) => `الطلب ${number} · "${subject}"`,
  ratingLegend: 'تقييمك',
  ratingGroupLabel: 'قيّم تجربة الدعم من 1 إلى 5',
  ratingOptions: ['1 – ضعيف', '2 – مقبول', '3 – جيد', '4 – جيد جدًا', '5 – ممتاز'],
  ratingEmojis: ['😞', '😐', '🙂', '😊', '🤩'],
  ratingSelected: (label) => `تم اختيار ${label}`,
  commentLabel: 'تعليق',
  commentOptional: '(اختياري)',
  commentHint: 'أي تفصيل يساعدنا على التحسّن — كلمة واحدة تكفي.',
  commentPlaceholder: 'أخبِرنا بما جرى بشكل جيد أو بما يمكن تحسينه…',
  submit: 'إرسال التقييم',
  submitting: 'جارٍ الإرسال…',
  submittedTitle: 'شكرًا لتقييمك',
  submittedBody: (number) => `تم تسجيل ردّك على الطلب ${number}. هذا يساعدنا على التحسّن باستمرار.`,
  answeredTitle: 'لقد قمت بالردّ بالفعل',
  yourResponse: 'ردّك',
  commentHeading: 'التعليق',
  submittedOn: (date) => `أُرسل في ${date}`,
  answeredFooter: 'تم تسجيل ردّك. شكرًا لك.',
  expiredTitle: 'لم يعد هذا الرابط نشطًا',
  expiredBody: 'تنتهي صلاحية روابط التقييم بعد 30 يومًا. لقد تجاوز هذا الرابط تلك المدة — لا حاجة لأي إجراء.',
  errorTitle: 'تعذّر تحميل هذه الصفحة',
  errorBody: 'تحقّق من اتصالك وحاول مرة أخرى.',
  retry: 'إعادة المحاولة',
  loading: 'جارٍ التحميل…',
  toggleTo: 'English',
};

export const CSAT_STRINGS: Record<CsatLocale, CsatStrings> = { en, ar };

/**
 * The browser decides. A `navigator.language` beginning with `ar` renders
 * Arabic; everything else renders English. The on-page toggle overrides this.
 */
export function detectCsatLocale(language: string | undefined = navigatorLanguage()): CsatLocale {
  return (language ?? '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function csatDir(locale: CsatLocale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

function navigatorLanguage(): string | undefined {
  return typeof navigator !== 'undefined' ? navigator.language : undefined;
}
