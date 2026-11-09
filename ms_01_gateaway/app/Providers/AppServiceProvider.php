<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        RateLimiter::for('api', fn (Request $request): Limit => Limit::perMinute(120)
            ->by((string) ($request->user('api')?->getAuthIdentifier() ?? $request->ip())));

        RateLimiter::for('login', fn (Request $request): Limit => Limit::perMinute(5)
            ->by($request->ip().'|'.mb_strtolower((string) $request->input('username'))));
    }
}
