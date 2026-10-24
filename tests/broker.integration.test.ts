import { describe, it, expect } from 'vitest';
import { createBrokerClient } from '@/lib/api/client';
import { halSchema, embedded, brokerPath, link } from '@/lib/api/hal';
import { participantSchema, object } from '@/lib/domain/models';
const base = process.env.PACT_TEST_BROKER_URL;
const suite = base ? describe : describe.skip;
suite('real disposable OSS Broker integration', () => {
  const client = createBrokerClient({ baseUrl: base || 'http://127.0.0.1:9293' });
  it('reads and validates paginated applications through the generated client', async () => {
    const result = await client.GET('/pacticipants', { params: { query: { page: 1, size: 2 } } });
    expect(result.response.status).toBe(200);
    const body = halSchema.parse(result.data);
    expect(embedded(body, 'pacticipants').map((x) => participantSchema.parse(x))).toHaveLength(2);
    expect(link(body, 'next')).toBeTruthy();
    const next = brokerPath(link(body, 'next')!, base!);
    const response = await fetch(`${base}${next}`, { headers: { Accept: 'application/hal+json' } });
    expect(response.status).toBe(200);
  });
  it('publishes and reads an application on the disposable instance', async () => {
    const name = `integration-${Date.now()}`;
    const created = await client.POST('/pacticipants', { body: { name, mainBranch: 'main' } });
    expect(created.response.status).toBe(201);
    const read = await client.GET('/pacticipants/{pacticipant_name}', {
      params: { path: { pacticipant_name: name } },
    });
    expect(participantSchema.parse(read.data).name).toBe(name);
  });
  it('preserves can-i-deploy unknown and confirmed incompatibility', async () => {
    const unknown = await client.GET('/can-i-deploy', {
      params: { query: { pacticipant: 'orders-api', version: '2.8.0', environment: 'production' } },
    });
    expect(unknown.response.status).toBe(200);
    expect(object(halSchema.parse(unknown.data).summary).deployable).toBeNull();
    const blocked = await client.GET('/can-i-deploy', {
      params: { query: { pacticipant: 'payments-api', version: '2.8.0', environment: 'staging' } },
    });
    expect(object(halSchema.parse(blocked.data).summary).deployable).toBe(false);
  });
  it('retrieves contract content and actual verification metadata', async () => {
    const result = await client.GET(
      '/pacts/provider/{provider_name}/consumer/{consumer_name}/version/{consumer_version_number}',
      {
        params: {
          path: {
            provider_name: 'payments-api',
            consumer_name: 'orders-api',
            consumer_version_number: '2.8.0',
          },
        },
      },
    );
    const pact = halSchema.parse(result.data);
    expect(Array.isArray(pact.interactions)).toBe(true);
    const verification = link(pact, 'pb:latest-verification-results')!;
    const response = await fetch(verification, { headers: { Accept: 'application/hal+json' } });
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.providerApplicationVersion).toBe('2.8.0');
  });
});
