import { describe, expect, it, vi } from 'vitest';
import { proxyBroker } from '@/lib/server/proxy';
import { serverConfig } from '@/lib/server/config';
const env = {
  PACT_BROKER_URL: 'https://broker.test/pact',
  PACT_BROKER_ALLOWED_URLS: 'https://second.test/broker',
};
function request(path = '/pacticipants', headers: HeadersInit = {}, method = 'GET') {
  const url = new URL('https://ui.test/api/broker');
  url.searchParams.set('path', path);
  return new Request(url, { method, headers });
}
describe('stateless per-user Broker proxy', () => {
  it('forwards each user’s credentials independently without cookies, redirects, or caching', async () => {
    const credentials: (string | null)[] = [];
    const fetcher = vi.fn(async (target: RequestInfo | URL, init?: RequestInit) => {
      expect(String(target)).toBe('https://broker.test/pact/pacticipants');
      const headers = new Headers(init?.headers);
      credentials.push(headers.get('Authorization'));
      expect(headers.has('Cookie')).toBe(false);
      expect(init).toMatchObject({ credentials: 'omit', redirect: 'manual', cache: 'no-store' });
      return Response.json({ _embedded: { pacticipants: [] } });
    });
    for (const auth of ['Basic dXNlcjE6cGFzczE=', 'Basic dXNlcjI6cGFzczI=', null]) {
      const headers = new Headers({ Cookie: 'private-app-cookie=value' });
      if (auth) headers.set('Authorization', auth);
      const response = await proxyBroker(request('/pacticipants', headers), env, fetcher);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    }
    expect(credentials).toEqual(['Basic dXNlcjE6cGFzczE=', 'Basic dXNlcjI6cGFzczI=', null]);
  });
  it('supports runtime URL defaults and additional explicitly allowed base paths', async () => {
    expect(serverConfig(env).allowedUrls).toEqual([
      'https://broker.test/pact',
      'https://second.test/broker',
    ]);
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toBe('https://second.test/broker/pacticipants');
      return Response.json({});
    });
    expect(
      (
        await proxyBroker(
          request('/pacticipants', { 'X-Pact-Broker-Url': 'https://second.test/broker/' }),
          env,
          fetcher,
        )
      ).status,
    ).toBe(200);
  });
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])(
    'rejects %s without upstream access',
    async (method) => {
      const fetcher = vi.fn();
      expect((await proxyBroker(request('/', {}, method), env, fetcher)).status).toBe(405);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each(['https://evil.test', 'http://169.254.169.254', 'https://broker.test/outside'])(
    'rejects unconfigured URL %s before sending credentials',
    async (base) => {
      const fetcher = vi.fn();
      expect(
        (
          await proxyBroker(
            request('/', { 'X-Pact-Broker-Url': base, Authorization: 'Basic dTpw' }),
            env,
            fetcher,
          )
        ).status,
      ).toBe(403);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each(['/../secret', '/%2e%2e/secret', '//evil.test', '/a%2f..%2f..%2fsecret'])(
    'rejects escaped path %s',
    async (path) => {
      const fetcher = vi.fn();
      expect((await proxyBroker(request(path), env, fetcher)).status).toBe(400);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it('rejects cross-origin callers and missing deployment configuration', async () => {
    const fetcher = vi.fn();
    expect(
      (await proxyBroker(request('/', { Origin: 'https://evil.test' }), env, fetcher)).status,
    ).toBe(403);
    expect((await proxyBroker(request(), {}, fetcher)).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserves authentication errors without triggering the browser’s Basic auth dialog', async () => {
    const response = await proxyBroker(
      request(),
      env,
      vi.fn(async () =>
        Response.json(
          { message: 'Invalid credentials' },
          {
            status: 401,
            headers: { 'WWW-Authenticate': 'Basic realm="Broker"', 'Set-Cookie': 'secret=value' },
          },
        ),
      ),
    );
    expect(response.status).toBe(401);
    expect(response.headers.has('WWW-Authenticate')).toBe(false);
    expect(response.headers.has('Set-Cookie')).toBe(false);
  });
  it('never follows redirects or forwards their location', async () => {
    const fetcher = vi.fn(
      async () => new Response(null, { status: 302, headers: { Location: 'https://evil.test' } }),
    );
    const response = await proxyBroker(request(), env, fetcher);
    expect(response.status).toBe(502);
    expect(response.headers.has('Location')).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bounds declared and streamed response sizes', async () => {
    const oversized = Response.json(
      {},
      { headers: { 'Content-Length': String(11 * 1024 * 1024) } },
    );
    expect(
      (
        await proxyBroker(
          request(),
          env,
          vi.fn(async () => oversized),
        )
      ).status,
    ).toBe(502);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(6 * 1024 * 1024));
        controller.enqueue(new Uint8Array(6 * 1024 * 1024));
        controller.close();
      },
    });
    expect(
      (
        await proxyBroker(
          request(),
          env,
          vi.fn(
            async () => new Response(stream, { headers: { 'Content-Type': 'application/json' } }),
          ),
        )
      ).status,
    ).toBe(502);
  });
  it('reports upstream network and non-JSON responses without leaking error internals', async () => {
    const network = await proxyBroker(
      request(),
      env,
      vi.fn(async () => {
        throw new TypeError('private network details');
      }),
    );
    expect(network.status).toBe(502);
    expect(await network.text()).not.toContain('private network');
    const html = await proxyBroker(
      request(),
      env,
      vi.fn(async () => new Response('<html>sign in</html>')),
    );
    expect(html.status).toBe(502);
  });
});
