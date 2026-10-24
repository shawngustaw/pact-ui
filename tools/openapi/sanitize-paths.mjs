import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [source, bundle] = process.argv.slice(2);
const prefixes = [];
for (const [directory, label] of [
  [root, '<pact-ui>'],
  [source, '<pact-broker>'],
  [bundle, '<bundle>'],
]) {
  if (!directory) continue;
  const absolute = resolve(directory);
  prefixes.push([absolute, label]);
  try {
    prefixes.push([realpathSync(absolute), label]);
  } catch {
    /* Historical capture paths may no longer exist. */
  }
}
prefixes.sort((a, b) => b[0].length - a[0].length);
for (const name of ['upstream-test-results.log', 'observations.jsonl']) {
  const path = resolve(root, 'openapi', name);
  let content = readFileSync(path, 'utf8');
  for (const [prefix, label] of prefixes) content = content.split(prefix + '/').join(label + '/');
  // Remove account names from any remaining home-directory paths in backtraces.
  content = content.replace(/\/(?:Users|home)\/[^/\s"'\\]+\//g, '<home>/');
  if (name.endsWith('.jsonl')) for (const line of content.trim().split('\n')) JSON.parse(line);
  writeFileSync(path, content);
}
