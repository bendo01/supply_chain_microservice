<?php

declare(strict_types=1);

use App\Http\Controllers\HealthController;
use App\Http\Middleware\CorrelationId;
use App\Http\Middleware\RecordAudit;
use App\Http\Middleware\RequireWritePermission;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        using: null,
        then: function (): void {
            Route::get('healthz', HealthController::class)->middleware([CorrelationId::class, RecordAudit::class]);
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Order: correlation-id -> (logging via Log context) -> rate limit -> auth -> permission -> audit
        $middleware->api(prepend: [CorrelationId::class], append: [RecordAudit::class]);
        $middleware->throttleApi('api');
        $middleware->redirectGuestsTo(static fn (): ?string => null);
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'gateway.write' => RequireWritePermission::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(static fn (Request $request): bool => true);
    })->create();
