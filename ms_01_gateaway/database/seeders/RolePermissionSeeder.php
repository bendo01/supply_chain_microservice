<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\RoleName;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (RoleName::allPermissions() as $name) {
            Permission::findOrCreate($name, 'api');
        }

        foreach (RoleName::cases() as $role) {
            Role::findOrCreate($role->value, 'api')->syncPermissions($role->permissions());
        }
    }
}
