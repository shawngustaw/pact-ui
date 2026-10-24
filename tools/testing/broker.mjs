// Browser-test fixture server only. Never included in the production app or image.
import http from 'node:http';
import fs from 'node:fs';
const fixtures = JSON.parse(
  fs.readFileSync(new URL('../../src/lib/demo/responses.json', import.meta.url)),
);
const port = Number(process.env.PACT_FIXTURE_PORT || 9294);
const origin = `http://127.0.0.1:${port}`;
const calls = [];
const server = http.createServer((request, response) => {
  const url = new URL(request.url, origin);
  if (url.pathname === '/health') {
    response.end('ok');
    return;
  }
  if (url.pathname === '/__test/requests') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(calls));
    return;
  }
  const mount = url.pathname.split('/')[1];
  const valid =
    request.headers.authorization ===
      `Basic ${Buffer.from('broker-user:broker-password').toString('base64')}` ||
    request.headers.authorization ===
      `Basic ${Buffer.from('other-user:other-password').toString('base64')}`;
  calls.push({
    method: request.method,
    path: request.url,
    hasAuthorization: !!request.headers.authorization,
    hasSession: !!request.headers.cookie?.includes('broker-session=fixture-session'),
    authenticated: !!valid,
  });
  if (!valid) {
    response.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="Pact Broker"',
      'Content-Type': 'application/json',
    });
    response.end(JSON.stringify({ message: 'Invalid Broker credentials.' }));
    return;
  }
  const path = url.pathname.slice(mount.length + 1) || '/';
  const key = path + url.search;
  ['page', 'size', 'pageNumber', 'pageSize'].forEach((name) => url.searchParams.delete(name));
  const record = fixtures.records[key] || fixtures.records[path + url.search];
  const json = JSON.stringify(record?.body || { message: 'Fixture not found.' }).replaceAll(
    fixtures.base_url,
    `${origin}/${mount}`,
  );
  response.writeHead(record?.status || 404, { 'Content-Type': 'application/hal+json' });
  response.end(json);
});
server.listen(port, '127.0.0.1', () => console.log(`Browser test Broker listening on ${origin}`));
