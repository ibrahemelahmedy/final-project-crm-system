<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Story 13 (CSAT Collection / WIS-14) — owns `csat_surveys`, one row per
     * ticket resolution cycle. This story does NOT touch the `tickets` table
     * (Story 04 owns it); `resolved_by` / `resolved_at` are copied here at
     * creation so Reports aggregates without re-deriving.
     *
     * The `rating BETWEEN 1 AND 5` CHECK is the second gate (the FormRequest
     * is the first). SQLite honours a CHECK only inside CREATE TABLE and has
     * no ALTER TABLE ADD CONSTRAINT, so on SQLite the check is emitted via a
     * raw column definition; on PostgreSQL it is added with ALTER TABLE.
     */
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        Schema::create('csat_surveys', function (Blueprint $table) use ($driver) {
            $table->bigIncrements('id');
            $table->uuid('uuid')->unique();
            $table->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
            $table->unsignedSmallInteger('resolution_cycle');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at');

            if ($driver === 'sqlite') {
                // SQLite: the CHECK must live in CREATE TABLE.
                $table->addColumn('integer', 'rating')->nullable();
            } else {
                $table->unsignedTinyInteger('rating')->nullable();
            }

            $table->text('comment')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->unique(['ticket_id', 'resolution_cycle']);
            $table->index(['resolved_by', 'responded_at']);
        });

        if ($driver === 'sqlite') {
            // Re-create with the CHECK: SQLite allows this only at build time,
            // and the table was just created empty, so a rename+copy is safe.
            DB::statement('ALTER TABLE csat_surveys RENAME TO csat_surveys__tmp');
            DB::statement(<<<'SQL'
                CREATE TABLE csat_surveys (
                    id integer primary key autoincrement not null,
                    uuid varchar not null,
                    ticket_id integer not null,
                    resolution_cycle integer not null,
                    resolved_by integer null,
                    resolved_at datetime not null,
                    rating integer null check (rating between 1 and 5),
                    comment text null,
                    responded_at datetime null,
                    expires_at datetime not null,
                    created_at datetime null,
                    updated_at datetime null,
                    foreign key(ticket_id) references tickets(id) on delete cascade,
                    foreign key(resolved_by) references users(id) on delete set null
                )
            SQL);
            DB::statement('INSERT INTO csat_surveys SELECT * FROM csat_surveys__tmp');
            DB::statement('DROP TABLE csat_surveys__tmp');
            DB::statement('CREATE UNIQUE INDEX csat_surveys_uuid_unique ON csat_surveys (uuid)');
            DB::statement('CREATE UNIQUE INDEX csat_surveys_ticket_id_resolution_cycle_unique ON csat_surveys (ticket_id, resolution_cycle)');
            DB::statement('CREATE INDEX csat_surveys_resolved_by_responded_at_index ON csat_surveys (resolved_by, responded_at)');
        } else {
            DB::statement('ALTER TABLE csat_surveys ADD CONSTRAINT csat_surveys_rating_range CHECK (rating BETWEEN 1 AND 5)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('csat_surveys');
    }
};
