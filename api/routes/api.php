<?php

use App\Http\Controllers\Admin\AdminUserController;
use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\ChannelOverviewController;
use App\Http\Controllers\CustomerAttachmentController;
use App\Http\Controllers\CustomerBulkController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CsatSurveyController;
use App\Http\Controllers\CustomerNoteController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Kb\KbArticleController;
use App\Http\Controllers\Kb\KbCategoryController;
use App\Http\Controllers\Kb\KbPreviewController;
use App\Http\Controllers\Kb\KbSearchController;
use App\Http\Controllers\MentionableUserController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\QuickReplyController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\TicketMessageController;
use App\Http\Controllers\TicketQuickReplyController;
use App\Http\Controllers\TicketTaskController;
use App\Http\Controllers\UserPreferencesController;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthenticatedSessionController::class, 'store'])
    ->middleware('throttle:login')
    ->name('login');


// `active` (App\Http\Middleware\ActiveUserOnly) is on the WHOLE authenticated
// group, so every endpoint in the app inherits it — that is what makes a
// deactivation bite on the user's NEXT REQUEST rather than their next login.
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy']);
    Route::get('/user', fn (Request $r) => new UserResource($r->user()));
    // Story 15 (WIS-11): the persistence path for the language switcher. No
    // `{user}` parameter — writes only the caller's own row.
    Route::patch('/user/preferences', [UserPreferencesController::class, 'update']);
    // /tickets/meta and /tickets/bulk must be declared before the
    // /tickets/{ticket} routes, or {ticket} swallows them as a model-binding id.
    Route::get('/tickets', [TicketController::class, 'index']);
    Route::get('/tickets/meta', [TicketController::class, 'meta']);
    Route::post('/tickets', [TicketController::class, 'store']);
    Route::post('/tickets/bulk', [TicketController::class, 'bulk']);
    Route::get('/tickets/{ticket}', [TicketController::class, 'show']);
    Route::patch('/tickets/{ticket}', [TicketController::class, 'update']);
    Route::get('/tickets/{ticket}/events', [TicketController::class, 'events']);
    // Story 13: the agent-facing CSAT read — latest survey for the ticket plus
    // a freshly minted share link. TicketPolicy@view is the boundary.
    Route::get('/tickets/{ticket}/csat', [CsatSurveyController::class, 'showForTicket']);
    Route::get('/tickets/{ticket}/messages', [TicketMessageController::class, 'index']);
    Route::post('/tickets/{ticket}/messages', [TicketMessageController::class, 'store']);

    // ---- Agent Productivity (Story 10) --------------------------------
    //
    // Quick replies: read is open to any authenticated user; write
    // (create/edit/archive) is team_lead/administrator only via
    // QuickReplyPolicy — no route-level role gate, the same pattern the KB
    // authoring routes use, because "any authenticated user" is not a
    // single-role predicate a route alias can express for the read side.
    Route::get('/quick-replies', [QuickReplyController::class, 'index']);
    Route::post('/quick-replies', [QuickReplyController::class, 'store']);
    Route::patch('/quick-replies/{quickReply}', [QuickReplyController::class, 'update']);
    Route::post('/quick-replies/{quickReply}/archive', [QuickReplyController::class, 'archive']);
    Route::get('/tickets/{ticket}/quick-replies', [TicketQuickReplyController::class, 'index']);

    Route::get('/tickets/{ticket}/tasks', [TicketTaskController::class, 'index']);
    Route::post('/tickets/{ticket}/tasks', [TicketTaskController::class, 'store']);
    // /tasks must be declared before nothing dynamic here collides — there is
    // no /tasks/{id} GET, only the assignee=me query contract Story 07 reads.
    Route::get('/tasks', [TaskController::class, 'index']);
    Route::patch('/tasks/{task}', [TaskController::class, 'update']);
    Route::post('/tasks/{task}/complete', [TaskController::class, 'complete']);

    Route::get('/tickets/{ticket}/mentionable-users', [MentionableUserController::class, 'index']);

    // /customers/facets and /customers/bulk must be declared before the
    // /customers/{customer} resource routes, or {customer} swallows them.
    Route::get('/customers/facets', [CustomerController::class, 'facets']);
    Route::post('/customers/bulk', CustomerBulkController::class);
    Route::apiResource('customers', CustomerController::class)->except(['destroy']);
    Route::delete('/customers/{customer}', [CustomerController::class, 'destroy']);
    Route::get('/customers/{customer}/tickets', [CustomerController::class, 'tickets']);
    // Role-based home dashboards (Story 07). One route per widget — the
    // independent-skeleton AC depends on separate requests.
    //
    // Story 08 consolidation: /admin/* now carries the shared `administrator`
    // gate instead of an inline UserRole check in the controller. /team/*
    // keeps its controller-side check because "team lead OR administrator" is
    // a two-role predicate the single-role gate does not express.
    Route::prefix('dashboard')->group(function () {
        Route::get('/agent/summary', [DashboardController::class, 'agentSummary']);
        Route::get('/agent/queue', [DashboardController::class, 'agentQueue']);
        Route::get('/agent/sla-risk', [DashboardController::class, 'agentSlaRisk']);
        Route::get('/team/summary', [DashboardController::class, 'teamSummary']);
        Route::get('/team/workload', [DashboardController::class, 'teamWorkload']);
        Route::get('/team/escalations', [DashboardController::class, 'teamEscalations']);
        Route::get('/admin/summary', [DashboardController::class, 'adminSummary'])
            ->middleware('administrator');
    });

    // ---- Reports & Management Dashboards (Story 12) -------------------
    //
    // One endpoint, one range, one payload — every widget on /reports renders
    // from this single response, which is what structurally prevents any
    // widget from showing a range different from its neighbours. Authorization
    // is ReportPolicy via the `view-reports` gate inside ReportSummaryRequest:
    // team_lead / administrator get 200, an Agent gets 403 with no partial
    // payload. There is deliberately no per-widget endpoint.
    Route::get('/reports/summary', [ReportController::class, 'summary']);

    // ---- Channels Overview (Story 14, read-only) ---------------------
    //
    // One GET, any authenticated role. There is deliberately NO POST/PATCH/
    // DELETE here and no channel-configuration route anywhere — connecting a
    // provider is out of scope (category 11). The controller aggregates the
    // `tickets.channel` column through the shared ticket-visibility scope.
    Route::get('/channels/overview', ChannelOverviewController::class);

    // ---- Administration (Story 08) ------------------------------------
    //
    // The `administrator` gate is on the GROUP, not on individual routes, so
    // a new admin endpoint cannot be added without a guard.
    // AdminAuthorizationTest walks the real route list and asserts exactly
    // that. There is deliberately no DELETE on a user (deactivation only, so
    // historical rows stay attributed) and no write verb of any kind on an
    // audit row.
    Route::prefix('admin')->middleware('administrator')->group(function () {
        // /users/facets before /users/{user}, or {user} swallows it.
        Route::get('/users/facets', [AdminUserController::class, 'facets']);
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::post('/users', [AdminUserController::class, 'store']);
        Route::get('/users/{user}', [AdminUserController::class, 'show']);
        Route::patch('/users/{user}', [AdminUserController::class, 'update']);
        Route::post('/users/{user}/deactivate', [AdminUserController::class, 'deactivate']);
        Route::post('/users/{user}/activate', [AdminUserController::class, 'activate']);

        Route::get('/audit-logs/facets', [AuditLogController::class, 'facets']);
        Route::get('/audit-logs', [AuditLogController::class, 'index']);

        Route::get('/settings', [SettingsController::class, 'index']);
        Route::patch('/settings', [SettingsController::class, 'update']);
    });

    // ---- Knowledge Base (Story 09) ------------------------------------
    //
    // Reading is open to every ACTIVE authenticated user — the group's
    // `active` middleware is the only gate on the read verbs. Authoring is
    // NOT gated here by a route middleware, because "Team Lead or
    // Administrator" is a two-role predicate the single-role `administrator`
    // gate does not express; KbArticlePolicy carries it instead, the same way
    // the /team/* dashboards do.
    //
    // /kb/articles/search and /kb/articles/most-viewed are literal segments
    // that must be declared BEFORE /kb/articles/{slug}, or {slug} swallows
    // them — the same ordering hazard as /tickets/meta and /customers/facets.
    Route::prefix('kb')->group(function () {
        Route::get('/categories', [KbCategoryController::class, 'index']);
        Route::get('/search', KbSearchController::class);
        // Renders un-saved Markdown through the SAME server-side pipeline that
        // writes body_html, so the editor preview cannot differ from the
        // reader — see KbPreviewController for why this is not done client-side.
        Route::post('/preview', KbPreviewController::class);

        Route::get('/articles', [KbArticleController::class, 'index']);
        Route::get('/articles/most-viewed', [KbArticleController::class, 'mostViewed']);
        Route::post('/articles/bulk', [KbArticleController::class, 'bulk']);
        Route::post('/articles', [KbArticleController::class, 'store']);
        Route::get('/articles/{slug}', [KbArticleController::class, 'show']);
        Route::patch('/articles/{slug}', [KbArticleController::class, 'update']);
        Route::post('/articles/{slug}/publish', [KbArticleController::class, 'publish']);
        Route::post('/articles/{slug}/unpublish', [KbArticleController::class, 'unpublish']);
        Route::post('/articles/{slug}/archive', [KbArticleController::class, 'archive']);
    });

    // ---- Notifications Centre (Story 11) -------------------------------
    //
    // MVP delivery is POLLING, not WebSocket push — a deliberate decision
    // (see the story plan). The unread-count query is cheap and scoped to
    // auth()->id(); every action here reads/writes only the caller's rows.
    Route::prefix('notifications')->group(function () {
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/read-all', [NotificationController::class, 'markAllRead']);
        Route::get('/', [NotificationController::class, 'index']);
        Route::post('/{notification}/read', [NotificationController::class, 'markRead']);
    });

    Route::get('/customers/{customer}/notes', [CustomerNoteController::class, 'index']);
    Route::post('/customers/{customer}/notes', [CustomerNoteController::class, 'store']);
    Route::get('/customers/{customer}/attachments', [CustomerAttachmentController::class, 'index']);
    Route::post('/customers/{customer}/attachments', [CustomerAttachmentController::class, 'store']);
    Route::get('/customers/{customer}/attachments/{attachment}', [CustomerAttachmentController::class, 'download'])
        ->name('customers.attachments.download');
    Route::delete('/customers/{customer}/attachments/{attachment}', [CustomerAttachmentController::class, 'destroy']);
});

// ---- CSAT public response surface (Story 13 / WIS-14) ----------------
//
// The FIRST public API routes in the app — deliberately OUTSIDE
// `auth:sanctum`. Access is a signed, expiring link (`signed`) and nothing
// else; the visitor is authenticated into nothing. `throttle:csat` is keyed
// on IP and separate from every other limiter, so survey traffic cannot
// exhaust the agent-facing API. SecurityHeaders is appended globally in
// bootstrap/app.php, so these responses carry the same headers as the rest.
//
// Route names `csat.show` / `csat.store` are the signing key — renaming
// either invalidates every outstanding link.
Route::middleware(['signed', 'throttle:csat'])->group(function () {
    Route::get('/csat/{uuid}', [CsatSurveyController::class, 'show'])->name('csat.show');
    Route::post('/csat/{uuid}', [CsatSurveyController::class, 'store'])->name('csat.store');
});
