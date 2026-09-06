# 002 — كل اختبارات الـ backend بتفشل: `pdo_sqlite` محجوب من سياسة الجهاز

**الحالة:** ✅ متحلّة (2026-09-03) — الاختبارات بتشتغل على Postgres محلي
**التاريخ:** 2026-09-02
**الخطورة:** كانت 🔴 حرج — **صفر تغطية اختبارات محليًا**

---

## ✅ الحل المطبَّق (2026-09-03)

`api/phpunit.xml` اتظبّط يستخدم **Postgres محلي** بدل SQLite (نفس محرك الإنتاج — Supabase).

1. اتعمل دور وقاعدة اختبار على PostgreSQL 18 المحلي:
   ```sql
   CREATE ROLE wisal_test LOGIN PASSWORD 'wisal_test';
   CREATE DATABASE wisal_testing OWNER wisal_test;
   ```
   (باسورد الـ `postgres` superuser كان مجهول — اتعمل تحويل مؤقت لـ `pg_hba.conf` إلى `trust`
   بصلاحية مسؤول، أُنشئ الدور، ثم استُرجع الملف. النسخة الاحتياطية اتحفظت أوتوماتيك.)

2. `api/phpunit.xml` — كتلة `<php>` بقت تحدّد كل `DB_*` صراحة على `pgsql` / `127.0.0.1:5432` /
   `wisal_testing` / `wisal_test`. تعليق مكتوب جوّه الملف بيشرح ليه، وإن CI يقدر يرجّع SQLite
   بمتغيرات بيئة (PHPUnit `<env>` مبيكتبش فوق متغير موجود فعلاً).

**نتيجة نهائية (بعد إصلاح عيوب البوابة + عيبين اختبار قديمين):**
`php artisan test` → **419 اختبار، 419 ✅** — الـ suite كامل أخضر لأول مرة.

### عيوب انكشفت بعد ما الـ suite بقى يشتغل

الحاجات دي كانت مخبّية طول ما الاختبارات مش شغّالة — اتصلحت في نفس الجلسة:

| المكان | المشكلة | الإصلاح |
|---|---|---|
| `app/Services/PortalAccess.php:211` | `now()->diffInSeconds($past)` سالب في Carbon 3 → الـ resend cooldown ما بينتهيش | `->diffInSeconds(now(), true)` (absolute) |
| `bootstrap/app.php` + `routes/api.php` | `/access/verify` و `/access/request` على نفس limiter 5/min → المحاولة السادسة 429 بدل 410 | limiter منفصل `portal-verify` (10/min) لـ verify |
| `PortalRequestController::show/reply` | 404 لتذكرة عميل تاني كان جسمه مختلف عن 404 لـ id مش موجود | إلغاء implicit binding — lookup واحد مسكوب على `customer_id` |
| `PortalRequestController` (store/reply) | ردود `PortalTicketResource` مغلّفة بـ `{"data":…}` بينما `show()` مش مغلّف | توحيد: كلهم `->resolve()` بدون غلاف |
| `tests/.../PortalTicketSubmissionTest.php` | بيتأكد إن أعمدة SLA اتختمت بس مش بيزرع `SlaRule` | `beforeEach` يزرع قاعدة `Priority::Normal` |
| `tests/.../Sla/AutoAssignmentTest.php:106` | يستعلم `audit_logs.action` — العمود اسمه `event` | تصحيح اسم العمود |

### ⚠️ لماذا فشل MySQL

جُرِّب MySQL الأول (متاح بلا باسورد). وقف عند
`2026_08_27_111743_create_customers_table.php:34`:
`CREATE UNIQUE INDEX ... WHERE ...` — **partial index**، مدعوم في Postgres وSQLite، مش في MariaDB.

### ⚠️ خطر تسرّب لـ Supabase

`api/.env` فيه `DB_CONNECTION=pgsql` بيشاور على Supabase السحابي بباسورد صريح. لو أي قيمة `DB_*`
وقعت على الـ fallback بتاع `.env`، `RefreshDatabase` كان هيفضّي قاعدة الإنتاج. عشان كده **كل**
قيم `DB_*` مثبّتة صراحة في `phpunit.xml`. `.env.testing` مالوش لازمة — Dotenv مبيكتبش فوق
`<env>` بتاع phpunit، فاتمسح.

### باقي مفتوح

`intl` ✅ متاح دلوقتي (القيد المسجّل في WIS-11 مابقاش صحيح). `pdo_sqlite` لسه محجوب —
لو اتفك مستقبلاً ممكن الرجوع لـ SQLite `:memory:` الأسرع بمتغيرات بيئة.

---

## التشخيص الأصلي

## إيه اللي شفناه

```bash
php artisan test --filter=Customer
```

النتيجة:

```json
{"tool":"pest","result":"failed","tests":46,"passed":0,"assertions":0,"errors":46}
```

**46 اختبار، نجح صفر.** وكل واحد فيهم بنفس الرسالة بالظبط:

```
could not find driver
(Connection: sqlite, Database: :memory:,
 SQL: select exists (select 1 from "main".sqlite_master
      where name = 'migrations' and type = 'table') as "exists")
```

وقبلها في الأول، تحذيرات وقت إقلاع PHP:

```
PHP Warning: PHP Startup: Unable to load dynamic library 'pdo_sqlite'
  (tried: ext\php_pdo_sqlite.dll (An Application Control policy has blocked this file))
PHP Warning: PHP Startup: Unable to load dynamic library 'pgsql' (... blocked ...)
PHP Warning: PHP Startup: Unable to load dynamic library 'exif' (... blocked ...)
```

## ليه حصل

سلسلة من تلات حلقات:

1. الاختبارات بتشتغل على قاعدة بيانات SQLite في الذاكرة — ده مكتوب في `api/phpunit.xml`:
   ```xml
   <env name="DB_CONNECTION" value="sqlite"/>
   <env name="DB_DATABASE" value=":memory:"/>
   ```
2. عشان PHP يتكلم مع SQLite لازم يحمّل `php_pdo_sqlite.dll`.
3. **سياسة Application Control على ويندوز بتحجب الملف ده** — مش PHP اللي ناقصه إضافة، ده منع أمني
   على مستوى النظام. (نفس السياسة حاجبة `pgsql` و`exif` كمان.)

فـ Laravel بيلاقي نفسه من غير أي driver لقاعدة البيانات، وكل اختبار بيلمس الداتابيز بيموت في نفس اللحظة.

> ⚠️ **تصحيح لاعتقاد كان عندنا:** كنا فاكرين إن "حوالي 10 اختبارات `Customer*` بتفشل على `main`"
> وإن ده الوضع الطبيعي المقبول. الحقيقة إن **كل** الاختبارات بتفشل، والسبب بيئي بالكامل —
> مفيش أي علاقة بكود الـ Customers. أي خطة كتبت "الاختبارات دي بتفشل أصلًا، تجاهلها" كانت
> بتوصف عَرَض غلط.

## الحل

### الأفضل — فك الحجب عن الإضافة

الملف موجود فعلًا على الجهاز، بس محجوب. محتاج صلاحية مسؤول أو استثناء في سياسة Application Control
لـ `php_pdo_sqlite.dll` (في مسار Herd: `C:\Users\ibrah\.config\herd\bin\...\ext\`).
ده شغل إدارة الجهاز، مش حاجة نصلحها من الكود.

للتأكد إن الحجب اتفك:

```bash
php -m | grep -i sqlite
```

### بديل — شغّل الاختبارات على MySQL بدل SQLite

لو فك الحجب مش ممكن، ظبّط `api/phpunit.xml` يستخدم قاعدة اختبار على MySQL (Herd فيه MySQL شغّال):

```xml
<env name="DB_CONNECTION" value="mysql"/>
<env name="DB_DATABASE" value="wisal_testing"/>
```

⚠️ الاختبارات هتبقى أبطأ، ولازم تتأكد إن `RefreshDatabase` بينضّف بينهم صح.

### بديل — CI

شغّل الاختبارات في GitHub Actions على Linux (فيه `pdo_sqlite` جاهز)، وخلّي الجهاز المحلي للتطوير بس.
ده بيدّينا تغطية حقيقية بدل الصفر الحالي.

## الدليل

- `php artisan test --filter=Customer` → 46 fail / 0 pass، نفس رسالة `could not find driver`
- `php -m` → `intl` موجود ✅ لكن `pdo_sqlite` مش موجود ❌
- `api/phpunit.xml` → سطور `DB_CONNECTION=sqlite` و`DB_DATABASE=:memory:`
- `api/config/database.php:20` → `'default' => env('DB_CONNECTION', 'sqlite')`

## ملحوظة جانبية إيجابية

نفس الفحص أثبت إن **`intl` شغّال دلوقتي** ✅ — وده كان مسجَّل كقيد في ستوري WIS-11
("الـ intl محجوب على جهاز التطوير"). القيد ده **مابقاش موجود**، فأي قرار اتاخد عشانه يستحق مراجعة.

## درس مستفاد

لما اختبار يفشل، **اقرأ الرسالة الأولى في الـ log مش الأخيرة**. تحذيرات إقلاع PHP كانت بتقول
السبب بالحرف من أول سطر، لكنها اتقريت كضوضاء واتجاهلت شهور.
