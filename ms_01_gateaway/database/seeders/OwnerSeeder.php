<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\RoleName;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

final class OwnerSeeder extends Seeder
{
    public function run(): void
    {
        $password = config('gateway.owner.password');
        if (! is_string($password) || $password === '') {
            throw new RuntimeException('OWNER_PASSWORD must be set to seed the initial OWNER account.');
        }

        $owner = User::query()->firstOrCreate(
            ['username' => (string) config('gateway.owner.username')],
            ['password' => $password, 'full_name' => (string) config('gateway.owner.full_name'), 'is_active' => true],
        );
        $owner->syncRoles([RoleName::Owner->value]);
    }
}
