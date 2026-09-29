import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

function run(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

test('node runs the TypeScript CLI directly, importing the sim through the workspace', () => {
  const result = run();
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('20 ticks/s');
});

test('an unknown command exits non-zero', () => {
  const result = run('nope');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Unknown command: nope');
});
