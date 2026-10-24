import { describe, it, expect, vi } from 'vitest';
import { createBrokerClient } from '@/lib/api/client';
import { brokerPath, paginate, halSchema, embedded, link } from '@/lib/api/hal';
import { brokerTarget } from '@/lib/api/transport';
import { initialConnection, normalizeBrokerUrl } from '@/lib/connection/config';
import {
  verificationStatus,
  compatibilityStatus,
  diffJson,
  safeExternalUrl,
  participantSchema,
} from '@/lib/domain/models';
import demo from '@/lib/demo/responses.json';

describe('Broker URL boundaries', () => {
  it('preserves base paths, encoded participant names and queries', () => {
    expect(
      brokerPath(
        'https://broker.test/pact/pacticipants/Some%20Service?page=2',
        'https://broker.test/pact',
      ),
    ).toBe('/pacticipants/Some%20Service?page=2');
    expect(
      brokerTarget('/pacticipants/Some%20Service?page=2', 'https://broker.test/pact').href,
    ).toBe('https://broker.test/pact/pacticipants/Some%20Service?page=2');
  });
  it.each([
    'https://evil.test/pacticipants',
    'https://broker.test/elsewhere',
    'https://broker.test/pact-evil/pacticipants',
  ])('rejects external HAL traversal: %s', (href) => {
    expect(() => brokerPath(href, 'https://broker.test/pact')).toThrow();
  });
  it.each([
    '//evil.test/a',
    '/../secret',
    '/%2e%2e/secret',
    '/a/%2F../secret',
    '/a\\b',
    '/a\n',
    '/a#fragment',
    '/%ZZ',
  ])('rejects path overrides and traversal: %s', (path) =>
    expect(() => brokerTarget(path, 'https://broker.test/pact')).toThrow(),
  );
});
describe('authentication and configuration', () => {
  it('supports Basic authentication in the generated client', async () => {
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      const r = request as Request;
      expect(r.headers.get('Authorization')).toBe('Basic dXNlcjpwYXNz');
      return Response.json({ _embedded: { pacticipants: [] } });
    });
    const client = createBrokerClient({
      baseUrl: 'https://broker.test',
      auth: { type: 'basic', username: 'user', password: 'pass' },
      fetch: fetcher as typeof fetch,
    });
    const result = await client.GET('/pacticipants');
    expect(result.response.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('supports Bearer authentication', async () => {
    const fetcher = vi.fn(async (request: RequestInfo | URL) => {
      expect((request as Request).headers.get('Authorization')).toBe('Bearer token');
      return Response.json({});
    });
    await createBrokerClient({
      baseUrl: 'https://broker.test',
      auth: { type: 'bearer', token: 'token' },
      fetch: fetcher as typeof fetch,
    }).GET('/');
  });
  it('is unconfigured without an explicit Broker or demo opt-in', () =>
    expect(initialConnection({}, null)).toMatchObject({ mode: 'unconfigured' }));
  it('supports explicit demo mode', () =>
    expect(initialConnection({ demo: true }, null)).toMatchObject({ mode: 'demo' }));
  it.each([
    'ftp://broker.test',
    'https://user:pass@broker.test',
    'https://broker.test?token=secret',
    'https://broker.test/#secret',
  ])('rejects invalid Broker URLs', (value) => expect(() => normalizeBrokerUrl(value)).toThrow());
});
describe('HAL pagination', () => {
  it('follows next links and preserves optional fields', async () => {
    const pages = [
      halSchema.parse({
        _embedded: { pacticipants: [{ name: 'a' }] },
        _links: { next: { href: '/pacticipants?page=2' } },
      }),
      halSchema.parse({ _embedded: { pacticipants: [{ name: 'b' }] } }),
    ];
    const load = vi.fn(async () => pages.shift()!);
    const items = [];
    for await (const page of paginate('/pacticipants', load))
      items.push(...embedded(page, 'pacticipants'));
    expect(items.map((x) => x.name)).toEqual(['a', 'b']);
    expect(load.mock.calls.length).toBe(2);
  });
  it('rejects cyclic pagination', async () => {
    await expect(async () => {
      for await (const _ of paginate('/a', async () =>
        halSchema.parse({ _links: { next: { href: '/a' } } }),
      )) {
      }
    }).rejects.toThrow('cycle');
  });
  it('honors cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const load = vi.fn();
    await expect(async () => {
      for await (const _ of paginate('/a', load, { signal: controller.signal })) {
      }
    }).rejects.toThrow();
    expect(load).not.toHaveBeenCalled();
  });
  it('does not follow templated links without expansion', () =>
    expect(
      link(halSchema.parse({ _links: { next: { href: '/a{?page}', templated: true } } }), 'next'),
    ).toBeUndefined());
});
describe('domain evidence', () => {
  it('distinguishes missing verification evidence from failure', () => {
    expect(verificationStatus(null)).toBe('unknown');
    expect(verificationStatus(false)).toBe('failed');
    expect(compatibilityStatus(undefined)).toBe('unknown');
    expect(compatibilityStatus(false)).toBe('blocked');
    expect(compatibilityStatus(true)).toBe('safe');
  });
  it('parses actual captured participants', () => {
    const resource = halSchema.parse(demo.records['/pacticipants'].body);
    expect(embedded(resource, 'pacticipants').map((a) => participantSchema.parse(a))).toHaveLength(
      8,
    );
  });
  it('reports structural additions, removals and changes', () =>
    expect(diffJson({ a: 1, b: 2 }, { a: 3, c: 4 })).toEqual([
      { path: '$.a', before: 1, after: 3, kind: 'changed' },
      { path: '$.b', before: 2, after: undefined, kind: 'removed' },
      { path: '$.c', before: undefined, after: 4, kind: 'added' },
    ]));
  it('rejects executable CI/repository links', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeExternalUrl('https://example.org/build')).toBe('https://example.org/build');
  });
});
