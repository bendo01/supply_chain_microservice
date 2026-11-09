<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\RoleName;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class RoleNameTest extends TestCase
{
    public function test_values_match_srs_roles(): void
    {
        $this->assertEqualsCanonicalizing(
            ['CASHIER', 'RETAIL_MANAGER', 'WAREHOUSE_MANAGER', 'SUPPLIER_ADMIN', 'COURIER', 'OWNER'],
            RoleName::values(),
        );
    }

    /** @return array<string, array{RoleName, ?string}> */
    public static function scopes(): array
    {
        return [
            'cashier' => [RoleName::Cashier, 'retail_id'],
            'retail manager' => [RoleName::RetailManager, 'retail_id'],
            'warehouse manager' => [RoleName::WarehouseManager, 'warehouse_id'],
            'supplier admin' => [RoleName::SupplierAdmin, 'supplier_id'],
            'courier' => [RoleName::Courier, null],
            'owner' => [RoleName::Owner, null],
        ];
    }

    #[DataProvider('scopes')]
    public function test_scope_column(RoleName $role, ?string $column): void
    {
        $this->assertSame($column, $role->scopeColumn());
    }

    public function test_every_role_permission_is_declared(): void
    {
        foreach (RoleName::cases() as $role) {
            $this->assertSame([], array_diff($role->permissions(), RoleName::allPermissions()), $role->value);
        }
    }

    public function test_only_owner_manages_users_and_commodities(): void
    {
        foreach (RoleName::cases() as $role) {
            $this->assertSame($role === RoleName::Owner, in_array('users.manage', $role->permissions(), true), $role->value);
            $this->assertSame($role === RoleName::Owner, in_array('commodity.manage', $role->permissions(), true), $role->value);
        }
    }

    public function test_owner_is_view_only_for_sales_and_payment(): void
    {
        $perms = RoleName::Owner->permissions();
        $this->assertNotContains('retail.sales', $perms);
        $this->assertNotContains('payment.access', $perms);
        $this->assertContains('retail.sales.read', $perms);
    }
}
