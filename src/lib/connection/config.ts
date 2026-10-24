import { z } from 'zod';
import type { BrokerAuth } from '@/lib/api/client';

export const CONNECTION_STORAGE_KEY = 'pact-ui-connection';
const publicConfigSchema = z.object({
  brokerUrl: z.string().default(''),
  demo: z.boolean().default(false),
});
const savedSchema = z.object({ mode: z.enum(['live', 'demo']), brokerUrl: z.string().optional() });
export interface Connection {
  mode: 'loading' | 'live' | 'demo' | 'unconfigured' | 'invalid';
  baseUrl?: string;
  auth?: BrokerAuth;
  sessionId: number;
  readOnly: true;
  configurationError?: string;
}
export function normalizeBrokerUrl(value: string): string {
  const url = new URL(value.trim());
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Enter an HTTP(S) Broker URL without credentials, a query, or a fragment.');
  if (/%2f|%5c/i.test(url.pathname))
    throw new Error('Broker base paths cannot contain encoded slashes.');
  return url.href.replace(/\/+$/, '');
}
export function initialConnection(
  rawConfig: unknown,
  saved: string | null,
  buildUrl = '',
  demoRequested = false,
): Connection {
  const config = publicConfigSchema.parse(rawConfig);
  const common = { sessionId: 0, readOnly: true as const };
  let preference: z.infer<typeof savedSchema> | undefined;
  if (saved) {
    try {
      preference = savedSchema.parse(JSON.parse(saved));
    } catch {
      /* Ignore malformed browser preferences; public configuration still applies. */
    }
  }
  if (demoRequested || preference?.mode === 'demo' || (!preference && config.demo))
    return { ...common, mode: 'demo', baseUrl: 'http://broker.example' };
  const value = preference?.brokerUrl || config.brokerUrl || buildUrl;
  return value
    ? { ...common, mode: 'live', baseUrl: normalizeBrokerUrl(value) }
    : { ...common, mode: 'unconfigured' };
}
/** Whitelist persisted public preferences so credentials can never enter browser storage. */
export function persistConnection(storage: Pick<Storage, 'setItem'>, connection: Connection) {
  storage.setItem(
    CONNECTION_STORAGE_KEY,
    JSON.stringify({
      mode: connection.mode,
      brokerUrl: connection.mode === 'live' ? connection.baseUrl : undefined,
    }),
  );
}
export async function loadConnection(signal?: AbortSignal): Promise<Connection> {
  try {
    const response = await fetch('/api/config', { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Could not load Broker configuration from the app server.');
    const config: unknown = await response.json();
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(CONNECTION_STORAGE_KEY);
    } catch {
      /* A connection can still be used when browser storage is disabled. */
    }
    return initialConnection(
      config,
      saved,
      '',
      new URLSearchParams(window.location.search).get('demo') === 'true',
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      mode: 'invalid',
      readOnly: true,
      sessionId: 0,
      configurationError:
        error instanceof Error ? error.message : 'Invalid workspace configuration.',
    };
  }
}
