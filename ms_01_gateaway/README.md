# ms_01 Gateway (Laravel)

Gateway API: JWT auth, RBAC (spatie/laravel-permission), reverse proxy to the internal services, rate limiting, `X-Correlation-Id`, and audit log. Spec: [documentation/software_requirement_specification.md](documentation/software_requirement_specification.md).

All PHP files use `declare(strict_types=1);` (enforced by `pint.json`; run `vendor/bin/pint`).

## Setup

```
composer install
createdb db_gateway
cp .env.example .env && php artisan key:generate && php artisan jwt:secret
# set DB_*, OWNER_PASSWORD, UPSTREAM_* in .env
php artisan migrate --seed      # roles, permissions, initial OWNER
php artisan serve --port=8080
php artisan test                # SQLite in-memory
```

## Behaviour

- `POST /api/auth/login|refresh|logout`: access token 15 min (JWT HS256, claims `role`, `retail_id`, `warehouse_id`, `supplier_id`); refresh token 7 days, opaque, stored as SHA-256 hash, rotated on every refresh.
- `/api/users` CRUD: role `OWNER` only. Scoped roles require their id (`CASHIER`/`RETAIL_MANAGER` → `retail_id`, `WAREHOUSE_MANAGER` → `warehouse_id`, `SUPPLIER_ADMIN` → `supplier_id`).
- `/api/{commodity,payment,retail,distribution,warehouse,supplier}/*` are forwarded to `UPSTREAM_*` with the **same path** (`/api/<service>/...`) plus `X-User-Id`, `X-Role`, `X-Retail-Id` (and `X-Warehouse-Id`, `X-Supplier-Id`), `X-Correlation-Id`. The `Authorization` header is not forwarded. Upstream down → 502, timeout → 504.
- Permissions per service/method are in `config/gateway.php` (read = GET/HEAD, write = others; optional `write_rules` per first path segment) and seeded from `App\Enums\RoleName` (SRS section 11 matrix).
- `/api/payment/qris/callback` is public (signature verified by Payment).
- `GET /healthz` checks the database.

## systemd (example)

```
[Service]
WorkingDirectory=/opt/supply_chain/ms_01_gateaway
ExecStart=/usr/bin/php artisan serve --host=127.0.0.1 --port=8080
Restart=always
```
(For production prefer php-fpm or Octane behind Ferron.)

## Testing

| Layer | Where | Style | What it checks |
|---|---|---|---|
| Unit | `tests/Unit` | whitebox | JWT claims/TTL, refresh-token hashing and rotation, argon2id, permission matrix, middleware internals (correlation-id sanitising, audit rows, write-permission rules), config consistency |
| Feature | `tests/Feature` | blackbox (API level) | Only HTTP requests and responses: login/refresh/logout, 401/403 RBAC matrix, user CRUD, validation, proxy headers/status mapping, rate limit |
| E2E | `scripts/e2e.sh` | blackbox (system level) | Real PHP server + real PostgreSQL (throwaway `db_gateway_e2e`) + real stub upstream, driven by curl |

```
php artisan test                                              # Unit + Feature (SQLite in memory)
./scripts/e2e.sh                                              # E2E; needs psql/createdb/curl/python3
XDEBUG_MODE=coverage vendor/bin/phpunit --coverage-text=cov.txt   # coverage (needs Xdebug or PCOV)
```
