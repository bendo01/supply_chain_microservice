<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\RoleName;
use App\Models\RefreshToken;
use App\Services\AuthService;
use Illuminate\Auth\AuthenticationException;
use Tests\TestCase;

final class AuthServiceTest extends TestCase
{
    private AuthService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = app(AuthService::class);
    }

    public function test_jwt_carries_role_and_scope_claims(): void
    {
        $user = $this->makeUser(RoleName::WarehouseManager);
        $pair = $this->svc->login($user->username, 'secret-pass-1');

        $payload = auth('api')->setToken($pair['access_token'])->getPayload();
        $this->assertSame($user->id, $payload->get('sub'));
        $this->assertSame('WAREHOUSE_MANAGER', $payload->get('role'));
        $this->assertSame($user->warehouse_id, $payload->get('warehouse_id'));
        $this->assertNull($payload->get('retail_id'));
        $this->assertSame(15 * 60, $payload->get('exp') - $payload->get('iat'));
    }

    public function test_refresh_token_stored_only_as_sha256_hash_with_7_day_expiry(): void
    {
        $user = $this->makeUser(RoleName::Owner);
        $pair = $this->svc->login($user->username, 'secret-pass-1');

        $row = RefreshToken::query()->sole();
        $this->assertSame(hash('sha256', $pair['refresh_token']), $row->token_hash);
        $this->assertNotSame($pair['refresh_token'], $row->token_hash);
        $this->assertEqualsWithDelta(now()->addDays(7)->getTimestamp(), $row->expires_at->getTimestamp(), 5);
    }

    public function test_refresh_revokes_old_row_and_creates_new(): void
    {
        $user = $this->makeUser(RoleName::Owner);
        $pair = $this->svc->login($user->username, 'secret-pass-1');
        $this->svc->refresh($pair['refresh_token']);

        $this->assertSame(2, RefreshToken::query()->count());
        $this->assertSame(1, RefreshToken::query()->where('revoked', true)->count());
    }

    public function test_expired_refresh_token_rejected(): void
    {
        $user = $this->makeUser(RoleName::Owner);
        $pair = $this->svc->login($user->username, 'secret-pass-1');
        RefreshToken::query()->update(['expires_at' => now()->subMinute()]);

        $this->expectException(AuthenticationException::class);
        $this->svc->refresh($pair['refresh_token']);
    }

    public function test_refresh_rejected_for_deactivated_user(): void
    {
        $user = $this->makeUser(RoleName::Owner);
        $pair = $this->svc->login($user->username, 'secret-pass-1');
        $user->update(['is_active' => false]);

        $this->expectException(AuthenticationException::class);
        $this->svc->refresh($pair['refresh_token']);
    }

    public function test_revoke_all_invalidates_every_token_of_user(): void
    {
        $user = $this->makeUser(RoleName::Owner);
        $a = $this->svc->login($user->username, 'secret-pass-1');
        $b = $this->svc->login($user->username, 'secret-pass-1');
        $this->svc->revokeAll($user);

        foreach ([$a, $b] as $pair) {
            try {
                $this->svc->refresh($pair['refresh_token']);
                $this->fail('refresh should have been rejected');
            } catch (AuthenticationException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_password_is_stored_hashed_with_argon2id(): void
    {
        $user = $this->makeUser(RoleName::Owner);
        $this->assertStringStartsWith('$argon2id$', $user->fresh()->getAuthPassword());
    }
}
