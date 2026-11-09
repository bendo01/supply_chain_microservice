<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPOpenSourceSaver\JWTAuth\JWTGuard;

final class AuthService
{
    /**
     * @return array{access_token: string, refresh_token: string, token_type: string, expires_in: int}
     *
     * @throws AuthenticationException
     */
    public function login(string $username, string $password): array
    {
        $user = User::query()->where('username', $username)->first();

        if ($user === null || ! $user->is_active || ! Hash::check($password, $user->password)) {
            throw new AuthenticationException('Invalid credentials.');
        }

        return $this->issue($user);
    }

    /**
     * Rotate: the presented refresh token is revoked and a new pair is issued.
     *
     * @return array{access_token: string, refresh_token: string, token_type: string, expires_in: int}
     *
     * @throws AuthenticationException
     */
    public function refresh(string $plainToken): array
    {
        return DB::transaction(function () use ($plainToken): array {
            $token = RefreshToken::query()
                ->where('token_hash', $this->hash($plainToken))
                ->lockForUpdate()
                ->first();

            if ($token === null || $token->revoked || $token->expires_at->isPast()) {
                throw new AuthenticationException('Invalid refresh token.');
            }

            $user = $token->user;
            if (! $user->is_active) {
                throw new AuthenticationException('Invalid refresh token.');
            }

            $token->update(['revoked' => true]);

            return $this->issue($user);
        });
    }

    public function logout(string $plainToken, User $user): void
    {
        RefreshToken::query()
            ->where('user_id', $user->getKey())
            ->where('token_hash', $this->hash($plainToken))
            ->update(['revoked' => true]);

        $this->guard()->logout();
    }

    public function revokeAll(User $user): void
    {
        RefreshToken::query()->where('user_id', $user->getKey())->update(['revoked' => true]);
    }

    /**
     * @return array{access_token: string, refresh_token: string, token_type: string, expires_in: int}
     */
    private function issue(User $user): array
    {
        $guard = $this->guard();
        $access = $guard->login($user);

        $plain = Str::random(64);
        RefreshToken::query()->create([
            'user_id' => $user->getKey(),
            'token_hash' => $this->hash($plain),
            'expires_at' => now()->addDays((int) config('gateway.refresh_token_ttl_days')),
            'revoked' => false,
        ]);

        return [
            'access_token' => $access,
            'refresh_token' => $plain,
            'token_type' => 'Bearer',
            'expires_in' => (int) config('jwt.ttl') * 60,
        ];
    }

    private function hash(string $plain): string
    {
        return hash('sha256', $plain);
    }

    private function guard(): JWTGuard
    {
        /** @var JWTGuard $guard */
        $guard = Auth::guard('api');

        return $guard;
    }
}
