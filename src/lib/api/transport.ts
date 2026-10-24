import { BrokerError, brokerPath } from './hal';
import { normalizeBrokerUrl, type Connection } from '@/lib/connection/config';

/** App paths are relative to the Broker base path, never to the SPA host. */
export function brokerTarget(path: string, baseUrl: string): URL {
  const base = normalizeBrokerUrl(baseUrl);
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u0020\u007f#]/.test(path))
    throw new BrokerError(400, 'Invalid Broker path.');
  const decoded = decodeURIComponent(path.split('?')[0]);
  if (
    decoded.split('/').some((part) => part === '.' || part === '..') ||
    /[\\\u0000-\u001f\u007f]/.test(decoded)
  )
    throw new BrokerError(400, 'Invalid Broker path encoding.');
  const target = new URL(base + path);
  brokerPath(target.href, base);
  return target;
}
export function normalizeResourcePath(href: string, baseUrl: string): string {
  if (!href.startsWith('/')) return brokerPath(href, baseUrl);
  if (href.startsWith('//'))
    throw new BrokerError(400, 'HAL link points outside the configured Broker.');
  // Some HAL links are origin-relative and include the deployment base path.
  const prefix = new URL(baseUrl).pathname.replace(/\/$/, '');
  return prefix &&
    (href === prefix || href.startsWith(prefix + '/') || href.startsWith(prefix + '?'))
    ? href.slice(prefix.length) || '/'
    : href;
}
export function connectionFetch(connection: Connection, signal?: AbortSignal): typeof fetch {
  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (!['GET', 'HEAD'].includes(request.method))
      throw new BrokerError(405, 'This workspace only reads Broker data.');
    if (!connection.baseUrl)
      throw new BrokerError(400, 'Configure a Broker URL in Connection settings.');
    // Validate before sending any Authorization header or browser credentials.
    brokerPath(request.url, connection.baseUrl);
    if (connection.mode === 'demo') {
      const { demoResponse } = await import('@/lib/demo/transport');
      return demoResponse(request);
    }
    try {
      const proxy = new URL('/api/broker', window.location.origin);
      proxy.searchParams.set('path', brokerPath(request.url, connection.baseUrl));
      const headers = new Headers({
        Accept: request.headers.get('Accept') || 'application/hal+json',
        'X-Pact-Broker-Url': connection.baseUrl,
      });
      const authorization = request.headers.get('Authorization');
      if (authorization) headers.set('Authorization', authorization);
      return await fetch(proxy, {
        method: request.method,
        headers,
        cache: 'no-store',
        signal: AbortSignal.any([signal || request.signal, AbortSignal.timeout(20000)]),
        credentials: 'same-origin',
        redirect: 'error',
      });
    } catch (error) {
      if (signal?.aborted || request.signal.aborted) throw error;
      throw new BrokerError(
        0,
        'Could not reach the app server. Check your connection and retry.',
        error,
      );
    }
  };
}
