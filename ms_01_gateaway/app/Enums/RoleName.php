<?php

declare(strict_types=1);

namespace App\Enums;

enum RoleName: string
{
    case Cashier = 'CASHIER';
    case RetailManager = 'RETAIL_MANAGER';
    case WarehouseManager = 'WAREHOUSE_MANAGER';
    case SupplierAdmin = 'SUPPLIER_ADMIN';
    case Courier = 'COURIER';
    case Owner = 'OWNER';

    /** Scope column the role must be bound to (null = global). */
    public function scopeColumn(): ?string
    {
        return match ($this) {
            self::Cashier, self::RetailManager => 'retail_id',
            self::WarehouseManager => 'warehouse_id',
            self::SupplierAdmin => 'supplier_id',
            self::Courier, self::Owner => null,
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $r): string => $r->value, self::cases());
    }

    /**
     * Permission matrix, SRS section 11.
     *
     * @return list<string>
     */
    public function permissions(): array
    {
        return match ($this) {
            self::Cashier => ['commodity.read', 'payment.access', 'retail.sales'],
            self::RetailManager => ['commodity.read', 'payment.read', 'retail.sales.read', 'retail.restock', 'retail.dashboard', 'distribution.read'],
            self::WarehouseManager => ['commodity.read', 'warehouse.access', 'distribution.access', 'retail.restock.process', 'supplier.order'],
            self::SupplierAdmin => ['supplier.access'],
            self::Courier => ['distribution.access'],
            self::Owner => array_values(array_diff(self::allPermissions(), ['retail.sales', 'payment.access'])),
        };
    }

    /** @return list<string> */
    public static function allPermissions(): array
    {
        return [
            'users.manage',
            'commodity.read', 'commodity.manage',
            'payment.access', 'payment.read',
            'retail.sales', 'retail.sales.read', 'retail.restock', 'retail.restock.process', 'retail.dashboard',
            'distribution.access', 'distribution.read',
            'warehouse.access',
            'supplier.access', 'supplier.order',
        ];
    }
}
