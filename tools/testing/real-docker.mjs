import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const compose = ['compose', '-p', 'pact-ui-real-e2e', '-f', 'tools/testing/compose.real.yaml'];
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}
try {
  // This fixed project is reserved for disposable test data. Start from a clean DB.
  run('docker', [...compose, 'down', '--volumes', '--remove-orphans']);
  run('docker', [...compose, 'up', '-d', '--build']);
  run(process.execPath, ['tools/testing/seed-real-broker.mjs']);
  run('npx', ['playwright', 'test', '--config', 'playwright.real.config.ts']);
} catch (error) {
  console.error(error.message);
  spawnSync('docker', [...compose, 'logs', '--no-color', '--tail', '60'], {
    cwd: root,
    stdio: 'inherit',
  });
  process.exitCode = 1;
} finally {
  const result = spawnSync('docker', [...compose, 'down', '--volumes', '--remove-orphans'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exitCode = 1;
}
