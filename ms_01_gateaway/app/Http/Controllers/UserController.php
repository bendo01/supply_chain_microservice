<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\UserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

final class UserController
{
    public function __construct(private readonly AuthService $auth) {}

    public function index(): AnonymousResourceCollection
    {
        return UserResource::collection(User::query()->with('roles')->orderBy('username')->paginate(25));
    }

    public function store(UserRequest $request): JsonResponse
    {
        /** @var array<string, mixed> $data */
        $data = $request->validated();
        $role = (string) $data['role'];
        unset($data['role']);

        $user = User::query()->create($data);
        $user->assignRole($role);

        return (new UserResource($user->load('roles')))->response()->setStatusCode(201);
    }

    public function show(User $user): UserResource
    {
        return new UserResource($user->load('roles'));
    }

    public function update(UserRequest $request, User $user): UserResource
    {
        /** @var array<string, mixed> $data */
        $data = $request->validated();
        $role = isset($data['role']) ? (string) $data['role'] : null;
        unset($data['role']);

        $user->update($data);
        if ($role !== null) {
            $user->syncRoles([$role]);
        }
        if (($data['is_active'] ?? true) === false || isset($data['password'])) {
            $this->auth->revokeAll($user);
        }

        return new UserResource($user->load('roles'));
    }

    public function destroy(User $user): Response
    {
        $user->delete();

        return response()->noContent();
    }
}
