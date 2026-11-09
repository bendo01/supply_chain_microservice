<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\RoleName;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class AuthTest extends TestCase
{
    public function test_login_returns_usable_token_pair(): void
    {
        Http::fake(['*' => Http::response('', 200)]);
        $user = $this->makeUser(RoleName::Cashier);

        $res = $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'secret-pass-1']);

        $res->assertOk()->assertJsonStructure(['access_token', 'refresh_token', 'token_type', 'expires_in'])
            ->assertJsonPath('expires_in', 900);
        $this->getJson('/api/commodity/items', ['Authorization' => 'Bearer '.$res->json('access_token')])->assertOk();
    }

    public function test_login_rejects_bad_password_and_inactive_user(): void
    {
        $user = $this->makeUser(RoleName::Cashier);
        $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'nope'])->assertUnauthorized();

        $user->update(['is_active' => false]);
        $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'secret-pass-1'])->assertUnauthorized();
    }

    public function test_refresh_rotates_and_old_token_is_rejected(): void
    {
        $user = $this->makeUser(RoleName::Owner);
        $first = $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'secret-pass-1'])->json();

        $second = $this->postJson('/api/auth/refresh', ['refresh_token' => $first['refresh_token']])->assertOk()->json();
        $this->assertNotSame($first['refresh_token'], $second['refresh_token']);

        $this->postJson('/api/auth/refresh', ['refresh_token' => $first['refresh_token']])->assertUnauthorized();
    }

    public function test_logout_revokes_refresh_token(): void
    {
        $user = $this->makeUser(RoleName::Owner);
        $tokens = $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'secret-pass-1'])->json();

        $this->postJson('/api/auth/logout', ['refresh_token' => $tokens['refresh_token']], ['Authorization' => 'Bearer '.$tokens['access_token']])->assertOk();

        $this->postJson('/api/auth/refresh', ['refresh_token' => $tokens['refresh_token']])->assertUnauthorized();
    }

    public function test_logout_requires_authentication(): void
    {
        $this->postJson('/api/auth/logout', ['refresh_token' => 'x'])->assertUnauthorized();
    }

    public function test_login_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['username' => 'ghost', 'password' => 'x'])->assertUnauthorized();
        }
        $this->postJson('/api/auth/login', ['username' => 'ghost', 'password' => 'x'])->assertStatus(429);
    }

    public function test_unauthenticated_without_accept_header_is_401_not_500(): void
    {
        $this->get('/api/retail/x')->assertUnauthorized();
    }
}
