<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Write (non-GET) access check: per-path rules first, then the service-wide 'write' permissions. */
final class RequireWritePermission
{
    public function handle(Request $request, Closure $next, string $service): Response
    {
        /** @var array{write: list<string>, write_rules?: array<string, list<string>>} $cfg */
        $cfg = config("gateway.services.{$service}");
        $segment = (string) explode('/', (string) $request->route('path'), 2)[0];
        $required = $cfg['write_rules'][$segment] ?? $cfg['write'];

        /** @var User|null $user */
        $user = $request->user('api');
        abort_if($user === null || ! $user->hasAnyPermission($required), 403, 'User does not have the right permissions.');

        return $next($request);
    }
}
