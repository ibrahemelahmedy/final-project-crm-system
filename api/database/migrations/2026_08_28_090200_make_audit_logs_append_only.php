<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * DB-level append-only enforcement for `audit_logs`.
 *
 * The intake asked for this "at the DB role level, if feasible". A REVOKE is
 * not feasible here: the app connects as the table owner, and an owner ignores
 * its own revoked grants. A trigger is, and it holds for every connection
 * including psql. Local development and the test suite run SQLite, which has
 * no equivalent, so this is a pgsql-only structural belt on top of the
 * unconditional model- and route-level guards.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP;
            END;
            $$ LANGUAGE plpgsql;
        SQL);

        DB::statement('DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON audit_logs');
        DB::statement(<<<'SQL'
            CREATE TRIGGER audit_logs_no_update_delete
            BEFORE UPDATE OR DELETE ON audit_logs
            FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
        SQL);
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON audit_logs');
        DB::statement('DROP FUNCTION IF EXISTS audit_logs_append_only()');
    }
};
