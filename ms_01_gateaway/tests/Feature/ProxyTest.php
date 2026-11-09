<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\RoleName;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class ProxyTest extends TestCase
{
    public function test_forwards_with_identity_headers_and_correlation_id(): void
    {
        Http::fake(['*' => Http::response(['ok' => true], 201, ['X-Up' => '1'])]);
        $user = $this->makeUser(RoleName::Cashier);

        $res = $this->postJson('/api/retail/sales?x=1', ['a' => 1], $this->bearer($user) + ['X-Correlation-Id' => 'abc-123', 'X-User-Id' => 'spoof']);

        $res->assertCreated()->assertJson(['ok' => true])->assertHeader('X-Correlation-Id', 'abc-123')->assertHeader('X-Up', '1');
        Http::assertSent(function (Request $r) use ($user): bool {
            return $r->url() === 'http://127.0.0.1:8083/api/retail/sales?x=1'
                && $r->method() === 'POST'
                && $r->header('X-User-Id') === [(string) $user->id]
                && $r->header('X-Role') === ['CASHIER']
                && $r->header('X-Retail-Id') === [$user->retail_id]
                && $r->header('X-Correlation-Id') === ['abc-123']
                && $r->header('Authorization') === []
                && $r->body() === '{"a":1}';
        });
    }

    public function test_rbac_matrix(): void
    {
        Http::fake(['*' => Http::response('', 200)]);
        $this->getJson('/api/retail/x')->assertUnauthorized();
        $cashier = $this->bearer($this->makeUser(RoleName::Cashier));
        $courier = $this->bearer($this->makeUser(RoleName::Courier));
        $owner = $this->bearer($this->makeUser(RoleName::Owner));

        $this->getJson('/api/warehouse/stock', $cashier)->assertForbidden();
        $this->postJson('/api/commodity/items', [], $cashier)->assertForbidden();
        $this->getJson('/api/commodity/items', $cashier)->assertOk();
        $this->getJson('/api/distribution/shipments', $courier)->assertOk();
        $this->getJson('/api/retail/dashboard', $courier)->assertForbidden();
        $this->postJson('/api/commodity/items', [], $owner)->assertOk();
        $this->postJson('/api/retail/sales', [], $owner)->assertForbidden(); // owner is view-only for sales
        $this->getJson('/api/retail/sales', $owner)->assertOk();
    }

    public function test_qris_callback_is_public_and_proxied(): void
    {
        Http::fake(['*' => Http::response(['received' => true])]);

        $this->postJson('/api/payment/qris/callback', ['ref' => 'r1'], ['X-Signature' => 'sig'])->assertOk();

        Http::assertSent(fn (Request $r): bool => $r->url() === 'http://127.0.0.1:8082/api/payment/qris/callback'
            && $r->header('X-User-Id') === []);
    }

    public function test_upstream_refused_maps_to_502(): void
    {
        Http::fake(fn () => throw new ConnectionException('Connection refused'));
        $this->getJson('/api/retail/x', $this->bearer($this->makeUser(RoleName::Owner)))->assertStatus(502);
    }

    public function test_upstream_timeout_maps_to_504(): void
    {
        $h = $this->bearer($this->makeUser(RoleName::Owner));

        Http::fake(fn () => throw new ConnectionException('cURL error 28: Operation timed out'));
        $this->getJson('/api/retail/x', $h)->assertStatus(504);
    }

    public function test_upstream_error_status_passes_through(): void
    {
        Http::fake(['*' => Http::response(['message' => 'nope'], 422)]);
        $this->getJson('/api/retail/x', $this->bearer($this->makeUser(RoleName::Owner)))->assertStatus(422)->assertJson(['message' => 'nope']);
    }

    public function test_correlation_id_generated_when_absent_and_healthz_is_public(): void
    {
        Http::fake(['*' => Http::response('', 200)]);

        $res = $this->getJson('/api/retail/x', $this->bearer($this->makeUser(RoleName::Owner)));
        $this->assertNotEmpty($res->headers->get('X-Correlation-Id'));

        $this->getJson('/healthz')->assertOk()->assertJson(['status' => 'ok']);
    }
}
