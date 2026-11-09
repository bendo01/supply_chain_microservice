<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RecordAudit
{
    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        if ($request->is('healthz')) {
            return;
        }

        AuditLog::query()->create([
            'user_id' => $request->user('api')?->getAuthIdentifier(),
            'method' => $request->method(),
            'path' => mb_substr('/'.ltrim($request->path(), '/'), 0, 255),
            'status_code' => $response->getStatusCode(),
            'correlation_id' => $request->header(CorrelationId::HEADER),
        ]);
    }
}
