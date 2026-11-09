<?php

declare(strict_types=1);

namespace Tests;

use App\Enums\RoleName;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Str;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    protected function makeUser(RoleName $role, string $password = 'secret-pass-1'): User
    {
        $column = $role->scopeColumn();
        $user = User::query()->create([
            'username' => strtolower($role->value).'_'.Str::random(5),
            'password' => $password,
            'full_name' => $role->value,
            'is_active' => true,
        ] + ($column !== null ? [$column => (string) Str::uuid()] : []));
        $user->assignRole($role->value);

        return $user;
    }

    /** @return array<string, string> */
    protected function bearer(User $user): array
    {
        return ['Authorization' => 'Bearer '.JWTAuth::fromUser($user)];
    }

    /** Reset cached guard user so each request authenticates from its own token. */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        $this->app['auth']->forgetGuards();
        foreach (['tymon.jwt', 'tymon.jwt.auth', 'tymon.jwt.parser', 'tymon.jwt.manager'] as $abstract) {
            $this->app->forgetInstance($abstract);
        }
        JWTAuth::clearResolvedInstances();

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }
}
