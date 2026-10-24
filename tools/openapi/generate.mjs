import fs from 'node:fs';
import { stringify } from 'yaml';
const root = new URL('../../', import.meta.url);
const file = (p) => new URL(p, root);
const inventory = JSON.parse(fs.readFileSync(file('openapi/source-inventory.json')));
const observations = fs
  .readFileSync(file('openapi/observations.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map(JSON.parse);
const clone = (v) => JSON.parse(JSON.stringify(v));
const unknown = (reason) => ({ 'x-uncertainty': reason });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
function upgrade(s) {
  if (Array.isArray(s)) return s.map(upgrade);
  if (!s || typeof s !== 'object') return s;
  const r = Object.fromEntries(
    Object.entries(s)
      .filter(([k]) => k !== '$schema' && k !== 'nullable')
      .map(([k, v]) => [k, upgrade(v)]),
  );
  if (r.format === 'date') {
    delete r.format;
    r['x-uncertainty'] =
      'Ruby date coercion accepts broader wire strings than JSON Schema date; runtime validation remains authoritative.';
  }
  if (r.type === 'object' && r.additionalProperties === undefined) r.additionalProperties = true;
  if (s.nullable) return { anyOf: [r, { type: 'null' }] };
  return r;
}
// Observation inference deliberately keeps response properties optional. A test example
// proves a field's representation, not its presence in every possible Broker response.
export function infer(values, depth = 0) {
  if (!values.length || depth > 14) return unknown('No nonempty example at this location.');
  const byType = Map.groupBy(values, (v) =>
    v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v,
  );
  const schemas = [...byType].map(([type, items]) => {
    if (type === 'object') {
      const keys = [...new Set(items.flatMap(Object.keys))].sort();
      return {
        type: 'object',
        properties: Object.fromEntries(
          keys.map((k) => [
            k,
            infer(
              items.filter((x) => Object.hasOwn(x, k)).map((x) => x[k]),
              depth + 1,
            ),
          ]),
        ),
        additionalProperties: true,
      };
    }
    if (type === 'array') return { type: 'array', items: infer(items.flat(), depth + 1) };
    return { type: type === 'number' ? 'number' : type };
  });
  return schemas.length === 1 ? schemas[0] : { anyOf: schemas };
}
const schemaName = (s) => s.split('::').at(-1);
const schemas = upgrade(inventory.existing_oas.components.schemas);
schemas.HalLink = {
  type: 'object',
  required: ['href'],
  properties: {
    href: { type: 'string' },
    templated: { type: 'boolean' },
    name: { type: 'string' },
    title: { type: 'string' },
  },
  additionalProperties: true,
};
schemas.HalLinks = {
  type: 'object',
  additionalProperties: { oneOf: [ref('HalLink'), { type: 'array', items: ref('HalLink') }] },
};
schemas.HalResource = {
  type: 'object',
  properties: {
    _links: ref('HalLinks'),
    _embedded: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
};
for (const [name, decorator] of Object.entries(inventory.decorators)) {
  const properties = {},
    embedded = {};
  for (const field of decorator.fields) {
    if (field.name === '_links') {
      properties._links = ref('HalLinks');
      continue;
    }
    let value = inventory.decorators[field.decorator]
      ? ref(schemaName(field.decorator))
      : unknown('Roar declares this field without a type. See observed operation schemas.');
    if (field.collection) value = { type: 'array', items: value };
    (field.embedded ? embedded : properties)[field.name] = value;
  }
  if (Object.keys(embedded).length)
    properties._embedded = { type: 'object', properties: embedded, additionalProperties: true };
  schemas[schemaName(name)] = {
    type: 'object',
    properties,
    additionalProperties: true,
    'x-source': decorator.sources,
  };
}
const canonical = (p) => p.replace(/\{[^}]+\}/g, '{}');
const patterns = inventory.routes.map((r) => ({
  ...r,
  regex: new RegExp(
    '^' + r.path.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+') + '/?$',
  ),
}));
// Match overlapping templates using the real Webmachine registration order.
patterns.sort((a, b) => a.registration_index - b.registration_index);
const grouped = new Map();
const unmatched = [];
for (const observation of observations) {
  const route = patterns.find((r) => r.regex.test(observation.path));
  if (!route || !route.methods.some((m) => m.method === observation.method)) {
    unmatched.push({
      method: observation.method,
      path: observation.path,
      status: observation.status,
    });
    continue;
  }
  const key = route.path + ' ' + observation.method;
  grouped.set(key, [...(grouped.get(key) || []), observation]);
}
const paths = {},
  coverage = [];
const auth = [{}, { basicAuth: [] }, { bearerAuth: [] }];
for (const [routeIndex, route] of inventory.routes.entries()) {
  const pathItem = {};
  paths[route.path] = pathItem;
  const existingPath = Object.entries(inventory.existing_oas.paths).find(
    ([p]) => canonical(p) === canonical(route.path),
  );
  for (const meta of route.methods) {
    const method = meta.method.toLowerCase();
    const observed = grouped.get(route.path + ' ' + meta.method) || [];
    const evidence = observed.filter(
      (o) => o.example_file?.includes('/features/') || o.example_file?.includes('/integration/'),
    );
    const old = upgrade(existingPath?.[1]?.[method]);
    const requestSchema = upgrade(meta.request_schema);
    if (requestSchema) schemas[schemaName(meta.request_schema_class)] = requestSchema;
    const querySchema =
      ['get', 'head'].includes(method) && meta.schema_input === 'query' ? requestSchema : null;
    const externalBody =
      requestSchema && meta.schema_input === 'body' ? clone(requestSchema) : null;
    if (externalBody)
      for (const field of meta.injected_fields || []) {
        delete externalBody.properties?.[field];
        externalBody.required = externalBody.required?.filter((k) => k !== field);
      }
    const queryKeys = new Set([
      ...Object.keys(querySchema?.properties || {}),
      ...meta.query_keys,
      ...observed.flatMap((o) => [...new URLSearchParams(o.query).keys()]),
    ]);
    const parameters = [...route.path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
      in: 'path',
      name,
      required: true,
      schema: { type: 'string' },
    }));
    for (const name of queryKeys) {
      const property = querySchema?.properties?.[name];
      const repeated = observed.some((o) => new URLSearchParams(o.query).getAll(name).length > 1);
      parameters.push({
        in: 'query',
        name,
        required: querySchema?.required?.includes(name) || false,
        ...(repeated ? { style: 'form', explode: true } : {}),
        schema:
          property ||
          (repeated ? { type: 'array', items: { type: 'string' } } : { type: 'string' }),
        ...(!property
          ? {
              description:
                'Wire parameter discovered in resource source or request tests; semantic constraints are not fully inferred.',
            }
          : {}),
      });
    }
    const responses = {};
    for (const status of [...new Set(observed.map((o) => String(o.status)))].sort()) {
      const samples = observed.filter((o) => String(o.status) === status),
        content = {};
      for (const media of [...new Set(samples.map((o) => o.content_type).filter(Boolean))]) {
        const bodies = evidence
          .filter(
            (o) =>
              String(o.status) === status && o.content_type === media && Object.hasOwn(o, 'body'),
          )
          .map((o) => o.body);
        if (media.includes('json')) {
          const name = `${route.name}_${routeIndex}_${method}_${status}`;
          schemas[name] = {
            ...infer(bodies),
            'x-evidence':
              'Observed from upstream feature/integration Rack::Test responses. Resource-unit samples are not used to infer wire shapes; optional fields and open objects are intentional.',
          };
          content[media] = { schema: ref(name) };
        } else content[media] = { schema: { type: 'string' } };
      }
      const headers = Object.fromEntries(
        [...new Set(samples.flatMap((o) => Object.keys(o.headers || {})))].map((name) => [
          name,
          { description: 'Observed upstream response header.', schema: { type: 'string' } },
        ]),
      );
      responses[status] = {
        ...(Object.keys(headers).length ? { headers } : {}),
        description: `Observed HTTP ${status} from upstream request tests.`,
        ...(Object.keys(content).length ? { content } : {}),
      };
    }
    // Existing reviewed schemas take precedence where the upstream spec provides them.
    if (old?.responses) Object.assign(responses, old.responses);
    const gaps = [];
    if (!evidence.some((o) => o.status >= 200 && o.status < 300)) {
      gaps.push(
        'No successful feature/integration response observed; response schema/status remains unverified.',
      );
      // Do not invent a 200/201 response for an unexercised method.
    }
    responses.default = {
      description:
        'Additional Webmachine, authentication middleware, validation, and unobserved responses. Exact status/body not inferred.',
      content: Object.fromEntries(
        meta.provides
          .filter((t) => t.includes('json'))
          .map((media) => [media, { schema: unknown('Unobserved response body.') }]),
      ),
    };
    const operation = {
      operationId: `${route.name}_${routeIndex}_${method}`,
      summary: old?.summary || `${meta.method} ${route.name.replaceAll('_', ' ')}`,
      tags: [route.path.split('/')[1] || 'index'],
      parameters,
      responses,
      'x-source': meta.sources,
      'x-resource': route.resource,
      'x-registration-order': route.registration_index,
      'x-observation-count': observed.length,
      'x-schema-evidence-count': evidence.length,
      'x-pagination': meta.paginated
        ? 'Opt-in page/size or pageNumber/pageSize; follow HAL next/previous links.'
        : 'No pagination mixin detected.',
    };
    operation.description =
      (old?.description ? old.description + '\n\n' : '') +
      'Accept selects a response media type; requestBody documents Content-Type. Authorization is deployment-configured through the security schemes. Conditional Webmachine header behavior is not fully inferred.';
    if (externalBody && ['post', 'put', 'patch'].includes(method)) {
      operation.requestBody = {
        required: !!meta.body_required || !!externalBody.required?.length,
        description:
          'Generated from the runtime dry-validation contract; conditional/custom rules remain in Ruby. See x-source.',
        content: Object.fromEntries(
          [
            ...new Set([
              ...meta.accepts,
              ...observed
                .filter((o) => o.status >= 200 && o.status < 300 && o.request)
                .map((o) => o.request_type),
            ]),
          ]
            .filter((t) => t.includes('json'))
            .map((media) => [media, { schema: externalBody }]),
        ),
      };
    } else if (old?.requestBody) operation.requestBody = old.requestBody;
    else if (
      ['post', 'put', 'patch'].includes(method) &&
      (meta.accepts.length || observed.some((o) => o.request))
    ) {
      const valid = evidence.filter(
        (o) => o.status >= 200 && o.status < 300 && Object.hasOwn(o, 'request'),
      );
      operation.requestBody = {
        required: !!meta.body_required,
        content: Object.fromEntries(
          [...new Set([...meta.accepts, ...valid.map((o) => o.request_type)])]
            .filter(Boolean)
            .map((media) => [
              media,
              {
                schema: valid.length
                  ? infer(valid.map((o) => o.request))
                  : unknown('Request body not fully inferred; inspect resource source.'),
              },
            ]),
        ),
      };
      gaps.push(
        'Request shape is example-derived or unknown; no dry-validation contract detected.',
      );
    }
    if (operation.requestBody && !Object.keys(operation.requestBody.content).length) {
      delete operation.requestBody;
      gaps.push('Request media type not inferred.');
    }
    if (gaps.length) operation['x-uncertainties'] = gaps;
    pathItem[method] = operation;
    coverage.push({
      path: route.path,
      method: meta.method,
      resource: route.resource,
      observations: observed.length,
      schemaEvidence: evidence.length,
      successfulEvidence: evidence.some((o) => o.status >= 200 && o.status < 300),
      successful: observed.some((o) => o.status >= 200 && o.status < 300),
      statuses: Object.keys(responses).filter((x) => x !== 'default'),
      gaps,
    });
  }
}
const spec = {
  openapi: '3.1.0',
  jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
  info: {
    title: 'Pact Broker API',
    version: inventory.upstream_sha.slice(0, 12),
    license: { name: 'MIT', identifier: 'MIT' },
    description:
      'Generated from OSS Pact Broker live route/contract introspection and upstream request tests. Route coverage is exhaustive for this commit; schema evidence varies. x-uncertainties and x-evidence distinguish inferred shapes from proven contracts. Authentication is deployment-configured.',
  },
  servers: [
    {
      url: 'http://localhost:9292',
      description: 'Example local Broker; configure your client base URL.',
    },
  ],
  security: auth,
  'x-upstream': {
    repository: 'https://github.com/pact-foundation/pact_broker',
    commit: inventory.upstream_sha,
  },
  paths,
  components: {
    securitySchemes: {
      basicAuth: { type: 'http', scheme: 'basic' },
      bearerAuth: { type: 'http', scheme: 'bearer' },
    },
    schemas,
  },
};
fs.writeFileSync(
  file('openapi/pact-broker.yaml'),
  stringify(spec, { lineWidth: 120, aliasDuplicateObjects: false }),
);
const report = {
  upstream: inventory.upstream_sha,
  routes: inventory.routes.length,
  operations: coverage.length,
  observations: observations.length,
  observedOperations: coverage.filter((x) => x.observations).length,
  successfulOperations: coverage.filter((x) => x.successful).length,
  schemaEvidenceOperations: coverage.filter((x) => x.schemaEvidence).length,
  successfulEvidenceOperations: coverage.filter((x) => x.successfulEvidence).length,
  coverage,
  unmatched,
};
fs.writeFileSync(file('openapi/coverage.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({ ...report, coverage: undefined, unmatched: unmatched.length }, null, 2),
);
