<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\CustomerAttachmentController;
use App\Http\Controllers\CustomerBulkController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerNoteController;
use App\Http\Controllers\TicketController;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthenticatedSessionController::class, 'store'])
    ->middleware('throttle:login')
    ->name('login');


Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy']);
    Route::get('/user', fn (Request $r) => new UserResource($r->user()));
    // /tickets/meta and /tickets/bulk must be declared before the
    // /tickets/{ticket} routes, or {ticket} swallows them as a model-binding id.
    Route::get('/tickets', [TicketController::class, 'index']);
    Route::get('/tickets/meta', [TicketController::class, 'meta']);
    Route::post('/tickets', [TicketController::class, 'store']);
    Route::post('/tickets/bulk', [TicketController::class, 'bulk']);
    Route::get('/tickets/{ticket}', [TicketController::class, 'show']);
    Route::patch('/tickets/{ticket}', [TicketController::class, 'update']);
    Route::get('/tickets/{ticket}/events', [TicketController::class, 'events']);

    // /customers/facets and /customers/bulk must be declared before the
    // /customers/{customer} resource routes, or {customer} swallows them.
    Route::get('/customers/facets', [CustomerController::class, 'facets']);
    Route::post('/customers/bulk', CustomerBulkController::class);
    Route::apiResource('customers', CustomerController::class)->except(['destroy']);
    Route::delete('/customers/{customer}', [CustomerController::class, 'destroy']);
    Route::get('/customers/{customer}/tickets', [CustomerController::class, 'tickets']);
    Route::get('/customers/{customer}/notes', [CustomerNoteController::class, 'index']);
    Route::post('/customers/{customer}/notes', [CustomerNoteController::class, 'store']);
    Route::get('/customers/{customer}/attachments', [CustomerAttachmentController::class, 'index']);
    Route::post('/customers/{customer}/attachments', [CustomerAttachmentController::class, 'store']);
    Route::get('/customers/{customer}/attachments/{attachment}', [CustomerAttachmentController::class, 'download'])
        ->name('customers.attachments.download');
    Route::delete('/customers/{customer}/attachments/{attachment}', [CustomerAttachmentController::class, 'destroy']);
});
