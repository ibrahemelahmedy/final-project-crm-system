<?php

namespace Database\Seeders;

use App\Enums\ArticleStatus;
use App\Enums\UserRole;
use App\Models\KbArticle;
use App\Models\KbCategory;
use App\Models\User;
use App\Services\MarkdownRenderer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Knowledge Base seed data (Story 09).
 *
 * The five categories and the five named articles match
 * docs/design/references/6.Knowledge/WisalKBIndex-LightLTR.dc.html, so a
 * running app matches the reference screenshot rather than showing lorem.
 *
 * It also seeds, on purpose:
 *  - one DRAFT, so the "invisible to an Agent" behaviour is reachable by hand;
 *  - one ARABIC article, so the reader's RTL and Arabic line-height rule can
 *    be verified without authoring one first;
 *  - one article whose Markdown carries a script payload, so the sanitizer can
 *    be seen working in the running app, not only in the test suite.
 */
class KnowledgeBaseSeeder extends Seeder
{
    public function run(): void
    {
        $markdown = app(MarkdownRenderer::class);

        $editor = User::where('role', UserRole::Administrator)->first()
            ?? User::where('role', UserRole::TeamLead)->first()
            ?? User::first();

        // The rail's five categories, in the artboard's order.
        $categories = collect([
            'Account & Access',
            'Billing',
            'Integrations',
            'Notifications',
            'Troubleshooting',
        ])->mapWithKeys(fn (string $name, int $i) => [
            $name => KbCategory::updateOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'position' => $i]
            ),
        ]);

        foreach ($this->articles() as $row) {
            $body = $row['body'];
            $bodyHtml = $markdown->render($body);

            KbArticle::updateOrCreate(
                ['slug' => $row['slug']],
                [
                    'title' => $row['title'],
                    'body' => $body,
                    'body_html' => $bodyHtml,
                    'excerpt' => $row['excerpt'] ?? $markdown->excerpt($bodyHtml),
                    'kb_category_id' => $categories[$row['category']]->id,
                    'status' => $row['status'],
                    'author_id' => $editor?->id,
                    'published_at' => $row['status'] === ArticleStatus::Published
                        ? now()->subDays($row['days_ago'])
                        : null,
                    'view_count' => $row['views'] ?? 0,
                ]
            );
        }

        // Enough further published articles to make server-side pagination
        // visibly real at 25/page across every category.
        foreach ($categories as $category) {
            KbArticle::factory()
                ->count(8)
                ->inCategory($category)
                ->create(['author_id' => $editor?->id]);
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function articles(): array
    {
        return [
            [
                'title' => 'How to reset your password',
                'slug' => 'how-to-reset-your-password',
                'category' => 'Account & Access',
                'status' => ArticleStatus::Published,
                'days_ago' => 8,
                'views' => 1420,
                'excerpt' => "Step-by-step instructions for requesting a reset link, why links expire after 15 minutes, and what to do if the email doesn't arrive.",
                'body' => <<<'MD'
If you've forgotten your password or been locked out of your account, resetting it takes less than a minute in most cases. This article walks through requesting a reset link, why the link has a short expiry window, and what to check if the email never arrives.

## Requesting a reset link

From the sign-in screen, select "Forgot password" and enter the email address associated with your account. We'll send a one-time reset link to that address within a few seconds. If you use single sign-on (SSO) through your organization, contact your workspace admin instead — SSO accounts don't have a separate Wisal password to reset.

## Why the link expires after 15 minutes

For security, reset links are single-use and expire 15 minutes after they're sent. This limits the window in which a link could be intercepted or reused. If your link has expired, simply request a new one — there's no limit on how many times you can do this in a day.

## The email hasn't arrived

First, check your spam or junk folder — automated security emails are sometimes filtered there. Next, confirm you're checking the inbox for the exact email address on file; many customers have more than one email and search the wrong one.

## Still can't get in?

If none of the above resolves it, open a support ticket from the sign-in page's "Contact support" link. An agent can verify your identity through an alternate method and manually clear any pending resets on the account.
MD,
            ],
            [
                'title' => 'Setting up two-factor authentication',
                'slug' => 'setting-up-two-factor-authentication',
                'category' => 'Account & Access',
                'status' => ArticleStatus::Published,
                'days_ago' => 10,
                'views' => 1180,
                'excerpt' => 'Enable SMS or authenticator-app based 2FA to add an extra layer of protection to your account in under two minutes.',
                'body' => <<<'MD'
Two-factor authentication (2FA) adds a second check on top of your password, so a leaked password alone is not enough to reach your account.

## Choosing a method

An authenticator app is the stronger option and works without cell signal. SMS is easier to set up but is vulnerable to SIM-swap attacks, so prefer the app where you can.

## Enrolling

Open **Settings → Security → Two-factor authentication**, scan the QR code with your authenticator app, then enter the six-digit code it shows to confirm the pairing.

## Recovery codes

Store the ten recovery codes somewhere outside the device running your authenticator. Losing both the device and the codes means an identity check with support before you can sign in again.
MD,
            ],
            [
                'title' => 'Understanding your monthly invoice',
                'slug' => 'understanding-your-monthly-invoice',
                'category' => 'Billing',
                'status' => ArticleStatus::Published,
                'days_ago' => 13,
                'views' => 960,
                'excerpt' => 'A breakdown of line items, proration charges, and how to download past invoices as PDF from the billing tab.',
                'body' => <<<'MD'
Your invoice covers one billing period and is issued on the same day each month.

## Line items

Each seat appears as its own line. Add-ons are itemized separately so a change in one does not obscure a change in another.

## Proration

Adding a seat mid-period charges the remaining days only. Removing one credits the remaining days against the next invoice rather than refunding to the card.

## Downloading past invoices

**Settings → Billing → Invoices** lists every issued invoice with a PDF download beside it, going back to the account's first billing period.
MD,
            ],
            [
                'title' => 'Connecting Slack to your workspace',
                'slug' => 'connecting-slack-to-your-workspace',
                'category' => 'Integrations',
                'status' => ArticleStatus::Published,
                'days_ago' => 16,
                'views' => 740,
                'excerpt' => 'Route ticket notifications and SLA alerts into a Slack channel of your choice, and how to disconnect it later.',
                'body' => <<<'MD'
The Slack integration posts ticket and SLA events into a channel you nominate.

## Authorizing the app

From **Settings → Integrations → Slack**, select *Connect*. Slack asks which workspace and which channel; the app requests only the permission to post into that one channel.

## Choosing which events post

Ticket created, ticket assigned, and SLA at risk can each be toggled independently. Leaving all three on in a busy queue is noisy — most teams keep only *SLA at risk*.

## Disconnecting

*Disconnect* on the same screen revokes the token immediately. Messages already posted stay in the channel; Slack does not let an app delete its own history retroactively.
MD,
            ],
            [
                'title' => 'Why am I being logged out repeatedly?',
                'slug' => 'why-am-i-being-logged-out-repeatedly',
                'category' => 'Troubleshooting',
                'status' => ArticleStatus::Published,
                'days_ago' => 19,
                'views' => 610,
                'excerpt' => 'Common causes: session timeout settings, browser extensions blocking cookies, and stale SSO tokens after a password change.',
                'body' => <<<'MD'
Repeated sign-outs almost always trace to one of three causes.

## Session timeout

An administrator can shorten the idle timeout for the whole workspace under **Settings → Security**. A timeout measured in minutes will log out anyone who steps away.

## Browser extensions

Privacy extensions that clear cookies between tabs will end the session on every navigation. Allow-listing the app resolves it.

## A stale SSO token

Changing your password at the identity provider invalidates the existing token. Signing out fully once and back in re-issues it.
MD,
            ],
            [
                // Reachable only by an editor. Confirms the visibility rule by
                // hand: an Agent's index, search, and direct URL must all miss it.
                'title' => 'Escalation matrix (internal draft)',
                'slug' => 'escalation-matrix-internal-draft',
                'category' => 'Troubleshooting',
                'status' => ArticleStatus::Draft,
                'days_ago' => 0,
                'views' => 0,
                'body' => <<<'MD'
Working notes for the revised escalation ladder. Not for agent use until reviewed by the support lead.

## Tier 1 to Tier 2

Hand off after 30 minutes without a reproducible cause.
MD,
            ],
            [
                // Arabic body: the reader must set dir="rtl" on the article
                // body from the CONTENT, independent of the app-wide direction,
                // while the English code block inside it stays LTR.
                'title' => 'كيفية إعادة تعيين كلمة المرور',
                'slug' => 'reset-password-ar',
                'category' => 'Account & Access',
                'status' => ArticleStatus::Published,
                'days_ago' => 5,
                'views' => 320,
                'body' => <<<'MD'
إذا نسيت كلمة المرور الخاصة بك أو تعذر عليك الوصول إلى حسابك، فإن إعادة تعيينها تستغرق أقل من دقيقة في معظم الحالات. يشرح هذا المقال كيفية طلب رابط إعادة التعيين، وسبب انتهاء صلاحيته سريعًا، وما الذي ينبغي التحقق منه إذا لم تصل الرسالة.

## طلب رابط إعادة التعيين

من شاشة تسجيل الدخول، اختر "نسيت كلمة المرور" وأدخل البريد الإلكتروني المرتبط بحسابك. سنرسل رابطًا لمرة واحدة خلال ثوانٍ قليلة.

## لماذا تنتهي صلاحية الرابط بعد ١٥ دقيقة

لأسباب أمنية، الرابط صالح لاستخدام واحد فقط وتنتهي صلاحيته بعد خمس عشرة دقيقة من إرساله.

## للمطورين

يمكن استدعاء نقطة النهاية مباشرة:

```
POST /api/password/reset
```

## لم تصل الرسالة

تحقق أولًا من مجلد الرسائل غير المرغوب فيها، ثم تأكد من أنك تتحقق من البريد الصحيح المسجل في الحساب.
MD,
            ],
            [
                // A body carrying four payloads. In the running app the reader
                // must show inert text: no script executes, no iframe frames,
                // no onerror fires, and the javascript: href is stripped.
                'title' => 'Formatting reference for article authors',
                'slug' => 'formatting-reference-for-article-authors',
                'category' => 'Notifications',
                'status' => ArticleStatus::Published,
                'days_ago' => 2,
                'views' => 95,
                'body' => <<<'MD'
Articles are written in Markdown. Raw HTML is stripped on save — the four examples below are deliberately included so the sanitizer is observable in the running app.

## What is stripped

<script>alert('xss')</script>
<img src="x" onerror="alert('xss')">
<iframe src="https://example.com"></iframe>
<a href="javascript:alert('xss')">a link with an unsafe scheme</a>

## What is kept

**Bold**, *italic*, `inline code`, lists, tables, headings, and links to [another article](/knowledge-base/how-to-reset-your-password).
MD,
            ],
        ];
    }
}
