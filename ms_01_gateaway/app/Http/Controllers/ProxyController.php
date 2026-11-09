<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Middleware\CorrelationId;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

final class ProxyController
{
    /** Response headers never copied back from upstream. */
    private const SKIP_RESPONSE = ['connection', 'keep-alive', 'transfer-encoding', 'content-length', 'content-encoding', 'te', 'trailer', 'upgrade'];

    public function __invoke(Request $request, string $service, string $path = ''): Response
    {
        /** @var array{upstream: string}|null $cfg */
        $cfg = config("gateway.services.{$service}");
        if ($cfg === null) {
            abort(404);
        }

        $url = rtrim($cfg['upstream'], '/').'/api/'.$service.($path !== '' ? '/'.$path : '');
        if (($qs = $request->getQueryString()) !== null && $qs !== '') {
            $url .= '?'.$qs;
        }

        $client = Http::withHeaders($this->forwardHeaders($request))
            ->withoutRedirecting()
            ->timeout((int) config('gateway.timeout'));

        $contentType = (string) $request->header('Content-Type', '');
        if ($request->getContent() !== '' && $contentType !== '') {
            $client = $client->withBody($request->getContent(), $contentType);
        }

        try {
            $upstream = $client->send($request->method(), $url);
        } catch (ConnectionException $e) {
            $timeout = str_contains(strtolower($e->getMessage()), 'timed out');

            return response()->json(
                ['message' => $timeout ? 'Upstream timeout.' : 'Upstream unavailable.'],
                $timeout ? 504 : 502,
            );
        }

        $response = response($upstream->body(), $upstream->status());
        foreach ($upstream->headers() as $name => $values) {
            if (! in_array(strtolower($name), self::SKIP_RESPONSE, true)) {
                $response->headers->set($name, $values);
            }
        }

        return $response;
    }

    /** @return array<string, string> */
    private function forwardHeaders(Request $request): array
    {
        $headers = [
            'Accept' => (string) $request->header('Accept', 'application/json'),
            'X-Correlation-Id' => (string) $request->header(CorrelationId::HEADER),
            'X-Forwarded-For' => (string) $request->ip(),
        ];

        /** @var User|null $user */
        $user = $request->user('api');
        if ($user !== null) {
            $headers['X-User-Id'] = (string) $user->getKey();
            $headers['X-Role'] = (string) $user->primaryRole();
            foreach (['retail_id' => 'X-Retail-Id', 'warehouse_id' => 'X-Warehouse-Id', 'supplier_id' => 'X-Supplier-Id'] as $col => $header) {
                if ($user->{$col} !== null) {
                    $headers[$header] = (string) $user->{$col};
                }
            }
        }

        return $headers;
    }
}
