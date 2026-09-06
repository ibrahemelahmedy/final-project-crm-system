# 005 — كل مسارات `/api/*` بترجع 404 على Vercel

**الحالة:** ✅ متحلّة
**الملف:** `api/api/index.php`

## إيه اللي شفناه

المسارات شغالة محليًا. على Vercel، **كل** مسار تحت `/api/` بيرجع 404 —
مش مسار واحد، كلهم. والتطبيق نفسه قايم عادي (مش وقع)، بس كإن مفيش routes مسجّلة.

## ليه حصل

على Vercel، الدالة (function) بتتحط في المسار `/api/index.php`.

Symfony (اللي Laravel مبني عليه) بيبص على مكان السكربت عشان يحسب "الـ base path" —
يعني الجزء اللي المفروض يتشال من أول العنوان قبل مطابقة الـ routes.

فلما يشوف السكربت في `/api/index.php`، بيستنتج إن `/api` ده مجرد مجلد وبيشيله من المسار.
الطلب `/api/tickets` بيوصل لـ router باسم `/tickets` — وده مش مسجّل، لأن كل الـ routes
معرّفة بـ prefix `/api`.

النتيجة: 404 على طول الخط.

## الحل

نثبّت اسم السكربت على الجذر، فSymfony ميشيلش حاجة:

```php
// api/api/index.php
// The function lives at /api/index.php, so Symfony would treat "/api" as the script
// base and strip it from the path — hiding every /api/* route. Pin the script to root.
$_SERVER['SCRIPT_NAME'] = '/index.php';
```

كده `/api/tickets` بيفضل `/api/tickets` وبيطابق الـ route صح.

## الدليل

الكود والتعليق الشارح موجودين في `api/api/index.php`.

## درس مستفاد

**"كل حاجة بترجع 404" ≠ "المسارات غلط".** لما *كل* المسارات تقع مرة واحدة، الشك يروح
لطبقة الـ routing نفسها — إزاي بيتقرا العنوان — مش لتعريفات المسارات.

## متعلقة بـ

- [003 — التطبيق بيموت على Vercel وقت الإقلاع](003-vercel-bootstrap-cache.md) — نفس الملف، مشكلة تانية
