<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\RoleName;
use Illuminate\Support\Str;
use Tests\TestCase;

final class UserCrudTest extends TestCase
{
    public function test_only_owner_can_manage_users(): void
    {
        $this->getJson('/api/users')->assertUnauthorized();
        $cashier = $this->makeUser(RoleName::Cashier);
        $this->getJson('/api/users', $this->bearer($cashier))->assertForbidden();
        $this->getJson('/api/users', $this->bearer($this->makeUser(RoleName::Owner)))->assertOk();
    }

    public function test_owner_creates_updates_deletes_user(): void
    {
        $h = $this->bearer($this->makeUser(RoleName::Owner));
        $retail = (string) Str::uuid();

        $id = $this->postJson('/api/users', [
            'username' => 'kasir1', 'password' => 'password-123', 'full_name' => 'Kasir Satu',
            'role' => 'CASHIER', 'retail_id' => $retail,
        ], $h)->assertCreated()->assertJsonPath('data.role', 'CASHIER')->json('data.id');

        $this->patchJson("/api/users/{$id}", ['role' => 'RETAIL_MANAGER', 'is_active' => false], $h)
            ->assertOk()->assertJsonPath('data.role', 'RETAIL_MANAGER')->assertJsonPath('data.is_active', false);

        $this->deleteJson("/api/users/{$id}", [], $h)->assertNoContent();
        $this->getJson("/api/users/{$id}", $h)->assertNotFound();
    }

    public function test_scope_id_required_for_scoped_roles_and_role_validated(): void
    {
        $h = $this->bearer($this->makeUser(RoleName::Owner));
        $base = ['username' => 'x1', 'password' => 'password-123', 'full_name' => 'X'];

        $this->postJson('/api/users', $base + ['role' => 'CASHIER'], $h)->assertUnprocessable()->assertJsonValidationErrors('retail_id');
        $this->postJson('/api/users', $base + ['role' => 'HACKER'], $h)->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->postJson('/api/users', $base + ['role' => 'COURIER'], $h)->assertCreated();
    }
}
