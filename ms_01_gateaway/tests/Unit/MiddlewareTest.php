<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\RoleName;
use App\Http\Middleware\CorrelationId;
use App\Http\Middleware\RecordAudit;
use App\Http\Middleware\RequireWritePermission;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

final class MiddlewareTest extends TestCase
{
    private function ok(): \Closure
    {
        return static fn (): Response => new Response('ok');
    }

    public function test_correlation_id_is_kept_when_valid(): void
    {
        $req = Request::create('/x');
        $req->headers->set('X-Correlation-Id', 'abc_123.X-9');
        $res = (new CorrelationId)->handle($req, $this->ok());
        $this->assertSame('abc_123.X-9', $res->headers->get('X-Correlation-Id'));
    }

    public function test_correlation_id_replaced_when_malicious_or_too_long(): void
    {
        foreach (["bad\r\nInjected: 1", str_repeat('a', 65), 'has space', ''] as $bad) {
            $req = Request::create('/x');
            $req->headers->set('X-Correlation-Id', $bad);
            $res = (new CorrelationId)->handle($req, $this->ok());
            $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', (string) $res->headers->get('X-Correlation-Id'));
        }
    }

    public function test_audit_terminate_records_row_and_skips_healthz(): void
    {
        $mw = new RecordAudit;
        $req = Request::create('/api/retail/x', 'POST');
        $req->headers->set('X-Correlation-Id', 'cid-1');
        $mw->terminate($req, new Response('', 201));
        $mw->terminate(Request::create('/healthz'), new Response('', 200));

        $this->assertSame(1, AuditLog::query()->count());
        $this->assertDatabaseHas('audit_logs', ['method' => 'POST', 'path' => '/api/retail/x', 'status_code' => 201, 'correlation_id' => 'cid-1', 'user_id' => null]);
    }

    private function writeRequest(string $service, string $path, ?RoleName $role): Request
    {
        $req = Request::create("/api/{$service}/{$path}", 'POST');
        $route = new Route('POST', "api/{$service}/{path?}", []);
        $route->bind($req);
        $req->setRouteResolver(static fn (): Route => $route);
        if ($role !== null) {
            $user = $this->makeUser($role);
            $req->setUserResolver(static fn () => $user);
        }

        return $req;
    }

    public function test_write_permission_uses_path_rule_then_service_default(): void
    {
        $mw = new RequireWritePermission;

        // Owner lacks retail.sales -> forbidden on /sales but allowed on /restock.
        try {
            $mw->handle($this->writeRequest('retail', 'sales', RoleName::Owner), $this->ok(), 'retail');
            $this->fail('expected 403');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
        $this->assertSame('ok', $mw->handle($this->writeRequest('retail', 'restock/1', RoleName::Owner), $this->ok(), 'retail')->getContent());
        $this->assertSame('ok', $mw->handle($this->writeRequest('retail', 'sales', RoleName::Cashier), $this->ok(), 'retail')->getContent());
        $this->assertSame('ok', $mw->handle($this->writeRequest('commodity', 'items', RoleName::Owner), $this->ok(), 'commodity')->getContent());
    }

    public function test_write_permission_denies_anonymous(): void
    {
        $this->expectException(HttpException::class);
        (new RequireWritePermission)->handle($this->writeRequest('retail', 'sales', null), $this->ok(), 'retail');
    }

    public function test_gateway_config_only_references_declared_permissions(): void
    {
        $declared = RoleName::allPermissions();
        foreach ((array) config('gateway.services') as $name => $cfg) {
            $used = [...$cfg['read'], ...$cfg['write'], ...array_merge([], ...array_values($cfg['write_rules'] ?? []))];
            $this->assertSame([], array_diff($used, $declared), (string) $name);
        }
    }
}
