<?php

declare(strict_types=1);

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProxyController;
use App\Http\Controllers\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('refresh', [AuthController::class, 'refresh'])->middleware('throttle:login');
    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:api');
});

Route::middleware(['auth:api', 'role:OWNER'])->group(function (): void {
    Route::apiResource('users', UserController::class);
});

// Public proxied paths (e.g. QRIS callback; signature is verified by Payment).
foreach ((array) config('gateway.public_proxy_paths') as $publicPath) {
    $service = explode('/', (string) $publicPath, 2)[0];
    $rest = explode('/', (string) $publicPath, 2)[1] ?? '';
    Route::any((string) $publicPath, fn (Request $r) => app(ProxyController::class)($r, $service, $rest));
}

// Authenticated proxied services with per-method permissions.
foreach ((array) config('gateway.services') as $service => $cfg) {
    $read = 'permission:'.implode('|', $cfg['read']);
    $write = 'gateway.write:'.$service;

    Route::middleware('auth:api')->prefix((string) $service)->group(function () use ($service, $read, $write): void {
        $where = ['path' => '.*'];
        Route::match(['GET', 'HEAD'], '{path?}', fn (Request $r, string $path = '') => app(ProxyController::class)($r, (string) $service, $path))
            ->where($where)->middleware($read);
        Route::match(['POST', 'PUT', 'PATCH', 'DELETE'], '{path?}', fn (Request $r, string $path = '') => app(ProxyController::class)($r, (string) $service, $path))
            ->where($where)->middleware($write);
    });
}
