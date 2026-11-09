<?php

declare(strict_types=1);

/*
 * Routing table: prefix => upstream + permissions (any-of) for read (GET/HEAD)
 * and write (other methods) requests. Permissions are spatie permissions.
 */
return [
    'refresh_token_ttl_days' => (int) env('REFRESH_TOKEN_TTL_DAYS', 7),
    'timeout' => (int) env('UPSTREAM_TIMEOUT', 15),

    'services' => [
        'commodity' => [
            'upstream' => env('UPSTREAM_COMMODITY', 'http://127.0.0.1:8081'),
            'read' => ['commodity.read', 'commodity.manage'],
            'write' => ['commodity.manage'],
        ],
        'payment' => [
            'upstream' => env('UPSTREAM_PAYMENT', 'http://127.0.0.1:8082'),
            'read' => ['payment.access', 'payment.read'],
            'write' => ['payment.access'],
        ],
        'retail' => [
            'upstream' => env('UPSTREAM_RETAIL', 'http://127.0.0.1:8083'),
            'read' => ['retail.sales', 'retail.sales.read', 'retail.restock', 'retail.restock.process', 'retail.dashboard'],
            'write' => ['retail.sales', 'retail.restock', 'retail.restock.process'],
            // First path segment => permissions (any-of) overriding 'write', e.g. OWNER may view but not create sales.
            'write_rules' => [
                'sales' => ['retail.sales'],
                'restock' => ['retail.restock', 'retail.restock.process'],
            ],
        ],
        'distribution' => [
            'upstream' => env('UPSTREAM_DISTRIBUTION', 'http://127.0.0.1:8084'),
            'read' => ['distribution.access', 'distribution.read'],
            'write' => ['distribution.access'],
        ],
        'warehouse' => [
            'upstream' => env('UPSTREAM_WAREHOUSE', 'http://127.0.0.1:8085'),
            'read' => ['warehouse.access'],
            'write' => ['warehouse.access'],
        ],
        'supplier' => [
            'upstream' => env('UPSTREAM_SUPPLIER', 'http://127.0.0.1:8086'),
            'read' => ['supplier.access', 'supplier.order'],
            'write' => ['supplier.access', 'supplier.order'],
        ],
    ],

    /** Public paths (relative to /api), still proxied and audited. */
    'public_proxy_paths' => ['payment/qris/callback'],

    'owner' => [
        'username' => env('OWNER_USERNAME', 'owner'),
        'password' => env('OWNER_PASSWORD'),
        'full_name' => env('OWNER_FULL_NAME', 'Pemilik'),
    ],
];
