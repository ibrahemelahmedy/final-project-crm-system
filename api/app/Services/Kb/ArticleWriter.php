<?php

namespace App\Services\Kb;

use App\Enums\ArticleStatus;
use App\Models\KbArticle;
use App\Models\KbArticleVersion;
use App\Models\User;
use App\Services\AuditTrail;
use App\Services\MarkdownRenderer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The one write path for a KB article (Story 09).
 *
 * Everything that mutates an article goes through here so three invariants
 * hold in exactly one place:
 *
 *  1. `body_html` is ALWAYS the MarkdownRenderer output for the current
 *     `body`. A controller can never set one without the other.
 *  2. A version row and the update it snapshots share ONE transaction, so a
 *     failed sanitize can never leave a version row without its article state.
 *  3. Publish / unpublish / archive write through Story 08's AuditTrail
 *     service; no feature writes audit rows directly.
 */
class ArticleWriter
{
    public function __construct(
        private readonly MarkdownRenderer $markdown,
        private readonly AuditTrail $audit,
    ) {}

    /**
     * @param  array{title: string, body?: string|null, kb_category_id?: int|null, excerpt?: string|null}  $data
     */
    public function create(array $data, User $author): KbArticle
    {
        $bodyHtml = $this->markdown->render($data['body'] ?? null);

        return KbArticle::create([
            'title' => $data['title'],
            'slug' => KbArticle::freshSlug($data['title']),
            'body' => $data['body'] ?? null,
            'body_html' => $bodyHtml,
            'excerpt' => $this->excerptFor($data, $bodyHtml),
            'kb_category_id' => $data['kb_category_id'] ?? null,
            'status' => ArticleStatus::Draft,
            'author_id' => $author->id,
        ]);
    }

    /**
     * Edit an article. A version row snapshotting the PRE-edit title and body
     * is written in the same transaction, so `updated_at` moving and the
     * version landing are one atomic fact.
     *
     * The slug is deliberately NOT recomputed from a new title — see
     * KbArticle::freshSlug()'s note: an existing published slug is never
     * silently repointed.
     *
     * @param  array{title?: string, body?: string|null, kb_category_id?: int|null, excerpt?: string|null}  $data
     */
    public function update(KbArticle $article, array $data, User $editor): KbArticle
    {
        return DB::transaction(function () use ($article, $data, $editor) {
            KbArticleVersion::create([
                'kb_article_id' => $article->id,
                'title' => $article->title,
                'body' => $article->body,
                'edited_by' => $editor->id,
            ]);

            $attributes = [];

            if (array_key_exists('title', $data)) {
                $attributes['title'] = $data['title'];
            }

            if (array_key_exists('kb_category_id', $data)) {
                $attributes['kb_category_id'] = $data['kb_category_id'];
            }

            if (array_key_exists('body', $data)) {
                $attributes['body'] = $data['body'];
                $attributes['body_html'] = $this->markdown->render($data['body']);
                $attributes['excerpt'] = $this->excerptFor($data, $attributes['body_html']);
            } elseif (array_key_exists('excerpt', $data)) {
                $attributes['excerpt'] = $data['excerpt'];
            }

            $article->fill($attributes);

            // An edit that changes nothing must still move the timestamp — the
            // reader's "Last updated" line is the staleness signal agents rely
            // on, and a no-op save would leave it lying.
            $article->updated_at = now();
            $article->save();

            return $article->refresh();
        });
    }

    /**
     * Draft/archived -> published.
     *
     * Title, body, and category are required to PUBLISH and are validated here
     * rather than in a FormRequest, because the same rule must fire for the
     * bulk-publish path, which never sees an article payload.
     *
     * @throws ValidationException 422 naming the missing field
     */
    public function publish(KbArticle $article, User $actor, Request $request): KbArticle
    {
        $this->assertPublishable($article);

        $article->status = ArticleStatus::Published;
        // First publish stamps published_at; re-publishing after an unpublish
        // keeps the original date, which is what "Published <date>" means.
        $article->published_at ??= now();
        $article->save();

        $this->audit->record(
            AuditTrail::KB_ARTICLE_PUBLISHED,
            $actor,
            $request,
            AuditTrail::target('kb_article', $article->id, $article->title)
        );

        return $article;
    }

    public function unpublish(KbArticle $article, User $actor, Request $request): KbArticle
    {
        $article->status = ArticleStatus::Draft;
        $article->save();

        $this->audit->record(
            AuditTrail::KB_ARTICLE_UNPUBLISHED,
            $actor,
            $request,
            AuditTrail::target('kb_article', $article->id, $article->title)
        );

        return $article;
    }

    public function archive(KbArticle $article, User $actor, Request $request): KbArticle
    {
        $article->status = ArticleStatus::Archived;
        $article->save();

        $this->audit->record(
            AuditTrail::KB_ARTICLE_ARCHIVED,
            $actor,
            $request,
            AuditTrail::target('kb_article', $article->id, $article->title)
        );

        return $article;
    }

    /** @throws ValidationException */
    public function assertPublishable(KbArticle $article): void
    {
        $errors = [];

        if (trim((string) $article->title) === '') {
            $errors['title'] = ['A title is required before an article can be published.'];
        }

        if (trim((string) $article->body) === '') {
            $errors['body'] = ['A body is required before an article can be published.'];
        }

        if (! $article->kb_category_id) {
            $errors['kb_category_id'] = ['A category is required before an article can be published.'];
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function excerptFor(array $data, string $bodyHtml): ?string
    {
        $supplied = trim((string) ($data['excerpt'] ?? ''));

        if ($supplied !== '') {
            return $supplied;
        }

        return $this->markdown->excerpt($bodyHtml) ?: null;
    }
}
