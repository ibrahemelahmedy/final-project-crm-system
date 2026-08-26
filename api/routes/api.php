<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
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
    Route::get('/tickets', [TicketController::class, 'index']);
});
