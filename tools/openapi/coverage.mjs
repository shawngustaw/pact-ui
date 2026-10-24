import fs from 'node:fs';
import { parse } from 'yaml';
const spec = parse(fs.readFileSync('openapi/pact-broker.yaml', 'utf8'));
const inventory = JSON.parse(fs.readFileSync('openapi/source-inventory.json'));
let operations = 0;
for (const route of inventory.routes)
  for (const method of route.methods) {
    operations++;
    if (!spec.paths[route.path]?.[method.method.toLowerCase()])
      throw Error(`Missing ${method.method} ${route.path}`);
  }
const actual = Object.values(spec.paths).reduce((n, item) => n + Object.keys(item).length, 0);
if (actual !== operations) throw Error('Unexpected generated operations.');
console.log(
  `${inventory.routes.length} / ${inventory.routes.length} routes and ${operations} / ${operations} operations covered. Schema coverage is reported separately in openapi/coverage.json.`,
);
