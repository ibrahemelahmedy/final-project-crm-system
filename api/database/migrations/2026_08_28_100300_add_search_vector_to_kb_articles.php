<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * PostgreSQL-only full-text search column, its GIN index, and the trigger that
 * keeps it current.
 *
 * Guarded on the driver exactly the way the audit-log migration promotes
 * `context` to jsonb (2026_08_25_200000_create_audit_logs_table.php), because
 * local development and the whole test suite run on SQLite (STATUS.md: local
 * pdo_pgsql is blocked by Windows Application Control). On SQLite this
 * migration is a no-op and App\Services\Kb\LikeArticleSearch takes over.
 *
 * setweight(title,'A') || setweight(body,'B') is what makes a title match
 * outrank a body-only match under ts_rank.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE kb_articles ADD COLUMN search_vector tsvector');

        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION kb_articles_search_vector_refresh() RETURNS trigger AS $$
            BEGIN
                NEW.search_vector :=
                    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(NEW.body, '')), 'B');
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;
        SQL);

        DB::statement(<<<'SQL'
            CREATE TRIGGER kb_articles_search_vector_trigger
            BEFORE INSERT OR UPDATE OF title, body ON kb_articles
            FOR EACH ROW EXECUTE FUNCTION kb_articles_search_vector_refresh();
        SQL);

        DB::statement('CREATE INDEX kb_articles_search_vector_idx ON kb_articles USING GIN (search_vector)');

        // Backfill anything the seeder inserted before this migration ran.
        DB::statement(<<<'SQL'
            UPDATE kb_articles SET search_vector =
                setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(body, '')), 'B');
        SQL);
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS kb_articles_search_vector_idx');
        DB::statement('DROP TRIGGER IF EXISTS kb_articles_search_vector_trigger ON kb_articles');
        DB::statement('DROP FUNCTION IF EXISTS kb_articles_search_vector_refresh()');
        DB::statement('ALTER TABLE kb_articles DROP COLUMN IF EXISTS search_vector');
    }
};
