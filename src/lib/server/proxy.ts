import { BrokerError } from '@/lib/api/hal';
import { brokerTarget } from '@/lib/api/transport';
import { normalizeBrokerUrl } from '@/lib/connection/config';
import { serverConfig } from './config';
const limit = 10 * 1024 * 1024;
const privateHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Authorization, X-Pact-Broker-Url',
  'X-Content-Type-Options': 'nosniff',
};
function failure(status: number, message: string) {
  return Response.json({ message }, { status, headers: privateHeaders });
}
/** Stateless: forwards only this request's credentials to an explicitly allowed Broker. */
export async function proxyBroker(
  request: Request,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method))
    return failure(405, 'This workspace only reads Broker data.');
  const url = new URL(request.url);
  if (
    (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site'
  )
    return failure(403, 'Cross-origin proxy requests are not allowed.');
  try {
    const config = serverConfig(env);
    if (!config.allowedUrls.length)
      return failure(503, 'Set PACT_BROKER_URL on the app server to enable live connections.');
    let base: string;
    try {
      base = normalizeBrokerUrl(request.headers.get('X-Pact-Broker-Url') || config.brokerUrl);
    } catch {
      return failure(400, 'Invalid Broker URL.');
    }
    if (!config.allowedUrls.includes(base))
      return failure(
        403,
        'This Broker URL is not allowed by the app server. Configure PACT_BROKER_URL or PACT_BROKER_ALLOWED_URLS.',
      );
    const target = brokerTarget(url.searchParams.get('path') || '/', base);
    const headers = new Headers({ Accept: 'application/hal+json, application/json' });
    const authorization = request.headers.get('Authorization');
    if (authorization) {
      if (!/^(Basic|Bearer) \S+$/i.test(authorization))
        return failure(400, 'Unsupported authentication header.');
      headers.set('Authorization', authorization);
    }
    const response = await fetcher(target, {
      method: request.method,
      headers,
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return failure(
        502,
        'The Broker redirected the request. Configure its final API URL; redirects are not followed.',
      );
    }
    const contentType = response.headers.get('Content-Type') || '';
    if (request.method === 'HEAD' || response.status === 204) {
      await response.body?.cancel();
      return new Response(null, { status: response.status, headers: privateHeaders });
    }
    if (!contentType.toLowerCase().includes('json')) {
      await response.body?.cancel();
      return failure(
        response.ok ? 502 : response.status,
        'The Broker did not return JSON. Check the Broker URL and credentials.',
      );
    }
    if (Number(response.headers.get('Content-Length') || 0) > limit) {
      await response.body?.cancel();
      return failure(502, 'Broker response exceeds the 10 MiB limit.');
    }
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) {
          await reader.cancel();
          return failure(502, 'Broker response exceeds the 10 MiB limit.');
        }
        chunks.push(value);
      }
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new Response(body, {
      status: response.status,
      headers: { ...privateHeaders, 'Content-Type': contentType },
    });
  } catch (error) {
    if (error instanceof BrokerError) return failure(error.status, error.message);
    if (error instanceof URIError) return failure(400, 'Invalid Broker URL or path.');
    return failure(
      502,
      'Could not reach the Broker from the app server. Check its URL, network access, and authentication.',
    );
  }
}
