# 003 — التطبيق بيموت على Vercel وقت الإقلاع (bootstrap cache)

**الحالة:** ✅ متحلّة
**التاريخ:** 2026-08-29
**الكوميت:** `d2064aa`

## إيه اللي شفناه

الـ API شغّال تمام محليًا، وأول ما يترفع على Vercel بيقع من أول طلب — التطبيق مش بيقلع أصلًا،
بيدوّر على كلاسات مش موجودة.

## ليه حصل

Laravel بيعمل ملفات cache للإقلاع (`packages.php`, `services.php`, `config.php`...) عشان يسرّع البداية.
الملفات دي بتتولّد **محليًا**، وعلى الجهاز المحلي إحنا مركّبين حزم التطوير (Pest, Pail, Collision).

بس Vercel بيبني الـ vendor بـ `--no-dev` — يعني **من غير** الحزم دي.

النتيجة: ملف `packages.php` المرفوع بيقول لـ Laravel "حمّل الـ providers دول"، وLaravel بيروح يدوّر
على كلاسات اتشالت من الـ vendor... وبيموت.

الفخ إن الملفات دي **مرفوعة مع الكود**، فالمشكلة مبتظهرش محليًا أبدًا.

## الحل

نوجّه كل ملفات الـ cache لمجلد `/tmp` (المكان الوحيد القابل للكتابة على Vercel)، فLaravel يبني
الـ cache من الـ vendor **الموجود فعلًا** بدل ما يقرا نسخة قديمة غلط:

```php
// api/api/index.php
$cacheDir = $storageDir . '/bootstrap-cache';
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0777, true);
}
foreach ([
    'APP_PACKAGES_CACHE' => 'packages.php',
    'APP_SERVICES_CACHE' => 'services.php',
    'APP_CONFIG_CACHE'   => 'config.php',
    'APP_ROUTES_CACHE'   => 'routes.php',
    'APP_EVENTS_CACHE'   => 'events.php',
] as $var => $file) {
    putenv("{$var}={$cacheDir}/{$file}");
    $_ENV[$var] = $_SERVER[$var] = "{$cacheDir}/{$file}";
}
```

## الدليل

```bash
git show d2064aa -- api/api/index.php
```

## درس مستفاد

أي حاجة **متولّدة** (cache، builds، ملفات مبنية) لو اترفعت مع الكود، هتحمل معاها افتراضات
بيئة التطوير لبيئة الإنتاج. لو مقدرناش نمنع رفعها، لازم نتأكد إن الإنتاج بيتجاهلها ويبني نسخته.

## متعلقة بـ

- [004 — الفرونت مش شايف الـ API](004-vercel-api-origin.md)
- [005 — كل مسارات `/api/*` بترجع 404](005-vercel-script-name.md)
