import { afterEach, describe, it, expect, vi } from 'vitest';
import { api } from '@/lib/api/browser';
import { authenticationHeaders } from '@/lib/api/client';
import { initialConnection, persistConnection, type Connection } from '@/lib/connection/config';
const connection: Connection = {
  mode: 'live',
  baseUrl: 'https://broker.test/broker',
  sessionId: 1,
  readOnly: true,
};
afterEach(() => vi.unstubAllGlobals());
import { beforeEach } from 'vitest';
beforeEach(() => vi.stubGlobal('window', { location: { origin: 'https://ui.test' } }));
describe('same-origin proxy browser transport', () => {
  it('calls the same-origin proxy with the configured Broker URL', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const request = new Request(input, options);
      expect(new URL(request.url).origin).toBe('https://ui.test');
      expect(new URL(request.url).searchParams.get('path')).toBe('/pacticipants?page=1&size=100');
      expect(request.headers.get('X-Pact-Broker-Url')).toBe(connection.baseUrl);
      expect(options?.credentials).toBe('same-origin');
      expect(options?.redirect).toBe('error');
      expect(request.headers.has('Authorization')).toBe(false);
      return Response.json({ _embedded: { pacticipants: [{ name: 'direct-app' }] } });
    });
    vi.stubGlobal('fetch', fetcher);
    expect((await api(connection).applications())[0].name).toBe('direct-app');
  });
  it('sends existing Basic credentials to the Broker in browser-compatible UTF-8 encoding', async () => {
    expect(
      authenticationHeaders({ type: 'basic', username: 'üser', password: 'päss' }).Authorization,
    ).toBe(`Basic ${Buffer.from('üser:päss').toString('base64')}`);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(new Headers(init?.headers).get('Authorization')).toBe('Basic dXNlcjpwYXNz');
        return Response.json({});
      }),
    );
    await api({ ...connection, auth: { type: 'basic', username: 'user', password: 'pass' } }).load(
      '/',
    );
  });
  it('follows HAL pagination within the configured Broker and base path', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const request = input as Request;
        calls.push(new URL(String(input)).searchParams.get('path') || '');
        return Response.json(
          calls.length === 1
            ? {
                _embedded: { versions: [{ number: '1' }] },
                _links: {
                  next: { href: 'https://broker.test/broker/pacticipants/a/versions?page=2' },
                },
              }
            : { _embedded: { versions: [{ number: '2' }] } },
        );
      }),
    );
    const records = await api(connection).collection('/pacticipants/a/versions', 'versions');
    expect(records.map((r) => r.number)).toEqual(['1', '2']);
    expect(calls[1]).toBe('/pacticipants/a/versions?page=2');
  });
  it('supports origin-relative HAL links including a base path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        expect(new URL(String(input)).searchParams.get('path')).toBe('/pacticipants');
        return Response.json({});
      }),
    );
    await api(connection).load('/broker/pacticipants');
  });
  it.each([
    'https://evil.test/pacticipants',
    'https://broker.test/outside',
    '//evil.test/pacticipants',
  ])('never sends credentials to an escaped HAL link: %s', async (path) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(api(connection).load(path)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects mutations in the workspace transport', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      api(connection).typed.POST('/pacticipants', { body: { name: 'write' } }),
    ).rejects.toThrow('only reads');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reports failed authentication without replacing it with sample data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(api(connection).applications()).rejects.toThrow('rejected authentication');
  });
  it('provides actionable app server network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(api(connection).load('/')).rejects.toThrow('app server');
  });
  it('honors cancellation rather than masking it as a connection failure', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw controller.signal.reason;
      }),
    );
    await expect(api(connection, controller.signal).load('/')).rejects.toThrow('abort');
  });
});
describe('public connection preferences', () => {
  it('loads runtime defaults, base paths, and a build-time fallback', () => {
    expect(initialConnection({ brokerUrl: 'https://broker.test/broker/' }, null).baseUrl).toBe(
      'https://broker.test/broker',
    );
    expect(initialConnection({}, null, 'https://build.test').baseUrl).toBe('https://build.test');
  });
  it('allows a saved URL to override deployment defaults', () =>
    expect(
      initialConnection(
        { brokerUrl: 'https://default.test' },
        JSON.stringify({ mode: 'live', brokerUrl: 'https://saved.test' }),
      ).baseUrl,
    ).toBe('https://saved.test'));
  it('ignores malformed saved preferences', () =>
    expect(initialConnection({ brokerUrl: 'https://default.test' }, 'not JSON').baseUrl).toBe(
      'https://default.test',
    ));
  it('persists only URL/mode and never credentials', () => {
    const storage = { setItem: vi.fn() };
    persistConnection(storage, {
      ...connection,
      auth: { type: 'basic', username: 'private-user', password: 'private-pass' },
    });
    expect(JSON.parse(storage.setItem.mock.calls[0][1])).toEqual({
      mode: 'live',
      brokerUrl: 'https://broker.test/broker',
    });
    expect(storage.setItem.mock.calls[0][1]).not.toContain('private');
  });
  it('supports explicit query demo without contacting a Broker', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const demo = initialConnection({}, null, '', true);
    expect(await api(demo).applications()).toHaveLength(8);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
