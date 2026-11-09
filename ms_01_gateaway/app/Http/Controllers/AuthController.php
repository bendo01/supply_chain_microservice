<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RefreshTokenRequest;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;

final class AuthController
{
    public function __construct(private readonly AuthService $auth) {}

    public function login(LoginRequest $request): JsonResponse
    {
        return response()->json($this->auth->login(
            (string) $request->validated('username'),
            (string) $request->validated('password'),
        ));
    }

    public function refresh(RefreshTokenRequest $request): JsonResponse
    {
        return response()->json($this->auth->refresh((string) $request->validated('refresh_token')));
    }

    public function logout(RefreshTokenRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('api');
        $this->auth->logout((string) $request->validated('refresh_token'), $user);

        return response()->json(['message' => 'Logged out.']);
    }
}
