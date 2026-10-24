// Publish synthetic test data through the real Broker HTTP API. No response fixtures.
import assert from 'node:assert/strict';
const base = process.env.PACT_REAL_BROKER_URL || 'http://127.0.0.1:9296';
const writer = `Basic ${Buffer.from('admin-test:writer-test-only').toString('base64')}`;
const reader = `Basic ${Buffer.from('reader-test:reader-test-only').toString('base64')}`;
async function call(path, method = 'GET', body, authorization = writer) {
  // HAL advertises the container-internal Broker URL; only its path is used here.
  const target = new URL(path, base);
  const response = await fetch(`${base}${target.pathname}${target.search}`, {
    method,
    headers: {
      Accept: 'application/hal+json, application/json',
      Authorization: authorization,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`${method} ${target.pathname}: ${response.status} ${text.slice(0, 500)}`);
  return { response, data: text ? JSON.parse(text) : {} };
}
let ready = false;
for (let attempt = 0; attempt < 90; attempt++) {
  try {
    await call('/');
    ready = true;
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
assert(ready, 'Real Broker did not become ready');
const consumer = 'docker-orders-api',
  provider = 'docker-payments-api';
const environments = {};
for (const name of ['production', 'staging']) {
  const { data } = await call('/environments', 'POST', {
    name,
    displayName: name === 'production' ? 'Production' : 'Staging',
    production: name === 'production',
  });
  environments[name] = data.uuid;
  assert(environments[name]);
}
for (const [version, success] of [
  ['1.0.0', true],
  ['2.0.0', false],
]) {
  const pact = {
    consumer: { name: consumer },
    provider: { name: provider },
    interactions: [
      {
        description: 'read an order from the real Docker Broker',
        providerStates: [{ name: 'order 42 exists' }],
        request: { method: 'GET', path: '/orders/42' },
        response: { status: 200, body: { id: '42', version } },
      },
    ],
    metadata: { pactSpecification: { version: '3.0.0' } },
  };
  const { data } = await call(
    `/pacts/provider/${provider}/consumer/${consumer}/version/${version}`,
    'PUT',
    pact,
  );
  const verification = data._links['pb:publish-verification-results'].href;
  await call(verification, 'POST', {
    providerApplicationVersion: version,
    success,
    buildUrl: `https://example.org/real-docker-build/${version}`,
  });
  for (const name of [consumer, provider]) {
    await call(`/pacticipants/${name}/branches/main/versions/${version}`, 'PUT', {});
    await call(`/pacticipants/${name}`, 'PATCH', { mainBranch: 'main' });
    await call(
      `/pacticipants/${name}/versions/${version}/deployed-versions/environment/${environments[version === '1.0.0' ? 'production' : 'staging']}`,
      'POST',
      {},
    );
  }
}
const unauthenticated = await fetch(`${base}/pacticipants`, {
  headers: { Accept: 'application/hal+json', Origin: 'http://127.0.0.1:3002' },
});
assert.equal(unauthenticated.status, 401);
assert.equal(unauthenticated.headers.get('Access-Control-Allow-Origin'), null);
const preflight = await fetch(`${base}/pacticipants`, {
  method: 'OPTIONS',
  headers: {
    Origin: 'http://127.0.0.1:3002',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization',
  },
});
assert.equal(preflight.status, 401);
const forbiddenWrite = await fetch(`${base}/pacticipants/forbidden-write`, {
  method: 'PUT',
  headers: { Authorization: reader, 'Content-Type': 'application/json' },
  body: '{}',
});
assert([401, 403].includes(forbiddenWrite.status));
const { data, response } = await call('/pacticipants', 'GET', undefined, reader);
assert.equal(data._embedded.pacticipants.length, 2);
assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
for (const [version, environment, expected] of [
  ['1.0.0', 'production', true],
  ['2.0.0', 'staging', false],
]) {
  const { data } = await call(
    `/can-i-deploy?pacticipant=${consumer}&version=${version}&environment=${environment}`,
    'GET',
    undefined,
    reader,
  );
  assert.equal(data.summary.deployable, expected);
}
console.log(
  JSON.stringify(
    {
      brokerVersion: response.headers.get('X-Pact-Broker-Version'),
      applications: 2,
      publishedContracts: 2,
      verifications: ['passed', 'failed'],
      environments: 2,
      unauthenticatedStatus: 401,
      preflightStatus: 401,
      readerWriteStatus: forbiddenWrite.status,
      corsAllowOrigin: null,
    },
    null,
    2,
  ),
);
