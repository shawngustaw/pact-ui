import createClient from 'openapi-fetch';
import type { paths } from './schema';

export type BrokerAuth =
  { type: 'basic'; username: string; password: string } | { type: 'bearer'; token: string };
export interface BrokerClientOptions {
  baseUrl: string;
  auth?: BrokerAuth;
  fetch?: typeof fetch;
  credentials?: RequestCredentials;
}
/** Per-user credentials work in browsers and Node. Nothing is persisted by this client. */
export function authenticationHeaders(auth?: BrokerAuth): Record<string, string> {
  if (!auth) return {};
  if (auth.type === 'bearer') return { Authorization: `Bearer ${auth.token}` };
  if (auth.username.includes(':'))
    throw new Error('A Basic authentication username cannot contain a colon.');
  const bytes = new TextEncoder().encode(`${auth.username}:${auth.password}`);
  const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
  return { Authorization: `Basic ${encoded}` };
}
export function createBrokerClient({
  baseUrl,
  auth,
  fetch: fetcher,
  credentials = 'include',
}: BrokerClientOptions) {
  return createClient<paths>({
    baseUrl,
    headers: { Accept: 'application/hal+json, application/json', ...authenticationHeaders(auth) },
    fetch: fetcher,
    credentials,
    redirect: 'error',
  });
}
