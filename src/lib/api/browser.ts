import { createBrokerClient, authenticationHeaders } from './client';
import { BrokerError, halSchema, paginate, embedded, type HalResource } from './hal';
import { brokerTarget, connectionFetch, normalizeResourcePath } from './transport';
import type { Connection } from '@/lib/connection/config';
export type { Connection } from '@/lib/connection/config';

export function responseError(status: number, details?: unknown): BrokerError {
  const data = details as { message?: string } | null;
  const message =
    status === 401
      ? 'The Broker rejected authentication (401). Sign in using your existing Broker credentials in Connection settings.'
      : status === 403
        ? data?.message || 'The Broker denied access (403). Check your existing Broker permissions.'
        : data?.message || `Broker request failed (HTTP ${status}).`;
  return new BrokerError(status, message, details);
}
async function result(response: Response): Promise<HalResource> {
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) throw responseError(response.status, json);
  if (json === null)
    throw new BrokerError(
      response.status,
      'The Broker did not return JSON. Check that the URL points to the Broker API and that your browser is signed in.',
    );
  return halSchema.parse(json);
}
export function api(connection: Connection, signal?: AbortSignal) {
  const fetcher = connectionFetch(connection, signal);
  const baseUrl = connection.baseUrl || 'http://unconfigured';
  const load = async (href: string) =>
    result(
      await fetcher(
        new Request(brokerTarget(normalizeResourcePath(href, baseUrl), baseUrl), {
          headers: {
            Accept: 'application/hal+json, application/json',
            ...authenticationHeaders(connection.auth),
          },
          credentials: 'include',
          redirect: 'error',
          signal,
        }),
      ),
    );
  const typed = createBrokerClient({ baseUrl, auth: connection.auth, fetch: fetcher });
  const collection = async (first: string, relation: string) => {
    const records: HalResource[] = [];
    for await (const page of paginate(first, load, { signal }))
      records.push(...embedded(page, relation));
    return records;
  };
  return {
    load,
    collection,
    typed,
    async applications() {
      const { data, error, response } = await typed.GET('/pacticipants', {
        params: { query: { page: 1, size: 100 } },
        signal,
      });
      if (!response.ok) throw responseError(response.status, error);
      const first = halSchema.parse(data),
        records = embedded(first, 'pacticipants');
      const next = first._links?.next,
        href = Array.isArray(next) ? next[0]?.href : next?.href;
      if (href) records.push(...(await collection(href, 'pacticipants')));
      return records;
    },
  };
}
