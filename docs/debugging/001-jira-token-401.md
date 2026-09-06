# 001 — توكن Jira مرفوض، والـ CLI بيقول "الإيشو مش موجود"

**الحالة:** 🔴 مفتوحة
**التاريخ:** 2026-09-02
**الخطورة:** متوسط — بيوقف أتمتة الستوريز، مش بيكسر التطبيق

## إيه اللي شفناه

شغّلنا الأمر ده عشان نجيب ستوري من Jira:

```bash
npx squad new-story customer-portal --id WIS-16 -y
```

الملف اتعمل، بس جواه ده وبس:

```
> **Tracker auto-fetch skipped.**
> Jira issue "WIS-16" not found on https://ibrahemelahmedy.atlassian.net/ (HTTP 404).
```

والعنوان والوصف والـ Acceptance Criteria كلهم **فاضيين**. نفس الحاجة حصلت في WIS-17 وWIS-18.

المُربك إن الإيشوز دي **موجودة فعلًا** على Jira — فاتحينها في المتصفح عادي.

## ليه حصل

التوكن اللي في `.squad/secrets.yaml` **منتهي أو ملغي**. أمر التشخيص كشفها:

```bash
npx squad doctor
```

```
✓  tracker configuration
✓  tracker credential resolves
✗  tracker connectivity — HTTP 401
```

**النقطة المهمة:** Jira لما بترفض قراءة إيشو لسبب صلاحيات، بترجّع **404 مش 401** — ده مقصود من Atlassian
عشان متقولش لحد "الإيشو ده موجود بس مش من حقك تشوفه". فالـ CLI صدّق الـ 404 وكتب "not found".

يعني الرسالة كانت **مضلِّلة**: المشكلة مش في رقم الإيشو ولا في عنوان الـ workspace، المشكلة في التوكن.

## الحل

### 1. اعمل توكن جديد

من **https://id.atlassian.com/manage-profile/security/api-tokens** → `Create API token` →
سمّيه مثلًا `squad-kit-wisal` → انسخ القيمة (بتظهر **مرة واحدة بس**).

ولو التوكن القديم لسه في اللستة، اعمله **Revoke**.

### 2. حطّه في squad-kit

```bash
npx squad config set tracker
```

هيسألك تفاعليًا عن النوع والـ workspace والإيميل والتوكن.

أو يدويًا في `.squad/secrets.yaml` (الملف ده متجاهَل في git — `.gitignore:2` — ومش متتبَّع، فآمن):

```yaml
tracker:
  jira:
    host: https://ibrahemelahmedy.atlassian.net/
    email: ibrahem.elahmedy@gmail.com
    token: >-
      <التوكن الجديد>
```

### 3. اتأكد

```bash
npx squad doctor
```

لازم السطر يبقى `✓ tracker connectivity`.

### الحل المؤقت اللي عملناه

لحد ما التوكن يتجدّد، جِبنا الأوصاف من Jira عن طريق **Atlassian MCP** (بيصادق بشكل منفصل وشغّال)
وملّينا الـ intake بالإيد حرفيًا — العنوان والوصف والميتاداتا.

⚠️ `npx squad tracker link` **مش** حل: هو بيكتب رقم الإيشو بس، عمره ما بيجيب المحتوى.

## الدليل

- `npx squad doctor` → السطر `✗ tracker connectivity — HTTP 401`
- الملفات اللي كانت فاضية واتملّت بالإيد:
  - `.squad/stories/customer-portal/WIS-16/intake.md`
  - `.squad/stories/i18n-retrofit/WIS-17/intake.md`
  - `.squad/stories/ai-assist-panel/WIS-18/intake.md`
- كل ملف فيهم دلوقتي بيبدأ بـ Source block بيوثّق إنه اتملّى بالإيد وليه.

## درس مستفاد

**404 من Jira ≠ مش موجود.** أول ما تشوف "not found" من أي أداة بتكلم Jira، شغّل `doctor` الأول
قبل ما تدوّر على رقم الإيشو أو تشك في الـ workspace.

## متعلقة بـ

- [010 — توكن مكتوب صريح في ملف غير محمي](010-plaintext-token.md)
