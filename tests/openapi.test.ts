import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, it, expect } from 'vitest';
import inventory from '../openapi/source-inventory.json';
const spec = parse(readFileSync('openapi/pact-broker.yaml', 'utf8'));
describe('generated specification', () => {
  it('matches every route and HTTP method in the actual inventory', () => {
    expect(Object.keys(spec.paths)).toHaveLength(inventory.routes.length);
    for (const route of inventory.routes)
      expect(Object.keys(spec.paths[route.path]).sort()).toEqual(
        route.methods.map((m) => m.method.toLowerCase()).sort(),
      );
  });
  it('pins its upstream and uses OpenAPI 3.1', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(spec['x-upstream'].commit).toBe(inventory.upstream_sha);
  });
  it('types known dry-validation fields and query parameters', () => {
    expect(spec.components.schemas.VerificationContract.required).toEqual([
      'success',
      'providerApplicationVersion',
    ]);
    expect(spec.components.schemas.VerificationContract.properties.success.type).toBe('boolean');
    expect(spec.paths['/can-i-deploy'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'pacticipant', in: 'query', required: true }),
      ]),
    );
  });
  it('keeps internal publication validators out of wire query parameters', () => {
    const operation =
      spec.paths[
        '/pacts/provider/{provider_name}/consumer/{consumer_name}/version/{consumer_version_number}'
      ].get;
    expect(
      operation.parameters
        .filter((p: { in: string }) => p.in === 'query')
        .map((p: { name: string }) => p.name),
    ).not.toContain('consumer_version_number');
    expect(operation.requestBody).toBeUndefined();
  });
  it('uses unique operation IDs and covers every path parameter', () => {
    const ids = [];
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const operation of Object.values(methods as Record<string, any>)) {
        ids.push(operation.operationId);
        for (const [, name] of path.matchAll(/\{([^}]+)\}/g))
          expect(operation.parameters).toContainEqual({
            name,
            in: 'path',
            required: true,
            schema: { type: 'string' },
          });
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});
