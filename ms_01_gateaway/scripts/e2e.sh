#!/usr/bin/env bash
# Black-box end-to-end test: real PHP server + real PostgreSQL + real stub upstream.
# Uses a throwaway database (db_gateway_e2e). Requires: psql, createdb, curl, python3.
set -euo pipefail
cd "$(dirname "$0")/.."

DB=db_gateway_e2e GW=18080 UP=18083
STUB=$(mktemp -d)
PIDS=()
cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done; dropdb --if-exists "$DB" >/dev/null 2>&1 || true; rm -rf "$STUB"; }
trap cleanup EXIT

cat > "$STUB/router.php" <<'P'
<?php
header('Content-Type: application/json');
echo json_encode(['path' => $_SERVER['REQUEST_URI'], 'method' => $_SERVER['REQUEST_METHOD'],
  'x_user' => $_SERVER['HTTP_X_USER_ID'] ?? null, 'x_role' => $_SERVER['HTTP_X_ROLE'] ?? null,
  'x_retail' => $_SERVER['HTTP_X_RETAIL_ID'] ?? null, 'cid' => $_SERVER['HTTP_X_CORRELATION_ID'] ?? null,
  'auth' => $_SERVER['HTTP_AUTHORIZATION'] ?? null]);
P

dropdb --if-exists "$DB" >/dev/null 2>&1; createdb "$DB"
export DB_DATABASE=$DB OWNER_PASSWORD='E2e-Pass-123!' UPSTREAM_RETAIL=http://127.0.0.1:$UP UPSTREAM_WAREHOUSE=http://127.0.0.1:1 CACHE_STORE=array
php artisan migrate:fresh --seed --force >/dev/null

php -S 127.0.0.1:$UP "$STUB/router.php" >/dev/null 2>&1 & PIDS+=($!)
php -S 127.0.0.1:$GW -t public public/index.php >/dev/null 2>&1 & PIDS+=($!)
for _ in $(seq 1 30); do curl -sf "http://127.0.0.1:$GW/healthz" >/dev/null && break; sleep 0.3; done

B=http://127.0.0.1:$GW
pass=0 fail=0
check() { # name expected actual
  if [[ "$2" == "$3" ]]; then pass=$((pass+1)); echo "ok   - $1"; else fail=$((fail+1)); echo "FAIL - $1 (expected '$2', got '$3')"; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
jget() { python3 -c 'import sys,json;d=json.load(sys.stdin)
for k in sys.argv[1].split("."): d=d[k]
print(d)' "$1"; }
J='Content-Type: application/json'

check "healthz" 200 "$(code $B/healthz)"
check "protected without token" 401 "$(code $B/api/retail/x)"
check "login bad password" 401 "$(code -X POST $B/api/auth/login -H "$J" -d '{"username":"owner","password":"bad"}')"

LOGIN=$(curl -s -X POST $B/api/auth/login -H "$J" -d '{"username":"owner","password":"E2e-Pass-123!"}')
AT=$(echo "$LOGIN" | jget access_token); RT=$(echo "$LOGIN" | jget refresh_token)
A="Authorization: Bearer $AT"

R=$(curl -s $B/api/retail/dashboard -H "$A" -H 'X-Correlation-Id: e2e-1' -H 'X-User-Id: spoofed')
check "upstream sees role" OWNER "$(echo "$R" | jget x_role)"
check "upstream sees correlation id" e2e-1 "$(echo "$R" | jget cid)"
check "spoofed X-User-Id overwritten" false "$([[ "$(echo "$R" | jget x_user)" == spoofed ]] && echo true || echo false)"
check "bearer token not forwarded" None "$(echo "$R" | jget auth)"
check "upstream path preserved" /api/retail/dashboard "$(echo "$R" | jget path)"

check "owner cannot create sales" 403 "$(code -X POST $B/api/retail/sales -H "$A" -H "$J" -d '{}')"
check "upstream down -> 502" 502 "$(code $B/api/warehouse/stock -H "$A")"

RID=$(python3 -c 'import uuid;print(uuid.uuid4())')
check "create cashier" 201 "$(code -X POST $B/api/users -H "$A" -H "$J" -d "{\"username\":\"kasir\",\"password\":\"password-123\",\"full_name\":\"K\",\"role\":\"CASHIER\",\"retail_id\":\"$RID\"}")"
CT=$(curl -s -X POST $B/api/auth/login -H "$J" -d '{"username":"kasir","password":"password-123"}' | jget access_token)
check "cashier forbidden on /api/users" 403 "$(code $B/api/users -H "Authorization: Bearer $CT")"
check "cashier forbidden on warehouse" 403 "$(code $B/api/warehouse/x -H "Authorization: Bearer $CT")"
check "cashier retail-id header" "$RID" "$(curl -s -X GET $B/api/retail/sales -H "Authorization: Bearer $CT" | jget x_retail)"

NEW=$(curl -s -X POST $B/api/auth/refresh -H "$J" -d "{\"refresh_token\":\"$RT\"}")
check "refresh ok" 200 "$(code -X POST $B/api/auth/refresh -H "$J" -d "{\"refresh_token\":\"$(echo "$NEW" | jget refresh_token)\"}")"
check "reused refresh token rejected" 401 "$(code -X POST $B/api/auth/refresh -H "$J" -d "{\"refresh_token\":\"$RT\"}")"

check "audit rows persisted" t "$(psql -tA "$DB" -c "select count(*) > 5 from audit_logs")"
check "no plaintext refresh token stored" 0 "$(psql -tA "$DB" -c "select count(*) from refresh_tokens where token_hash = '$RT'")"

echo; echo "passed=$pass failed=$fail"
[[ $fail -eq 0 ]]
