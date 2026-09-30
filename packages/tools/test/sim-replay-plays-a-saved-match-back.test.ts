import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadReplay } from '@factor/content';
import { expect, test } from 'vitest';
import { botReplay, emptyReplay } from '../src/index.ts';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const cwd = mkdtempSync(join(tmpdir(), 'factor-replay-'));

function sim(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd });
}

test('match saves its replay under replays/ by default, and replay prints the same result', () => {
  const played = sim('match', '--seed', '42');
  expect(played.status).toBe(0);
  expect(played.stdout).toContain('replay  replays/seed-42.json');
  const file = join(cwd, 'replays', 'seed-42.json');
  expect(loadReplay(readFileSync(file, 'utf8'))).toEqual(botReplay(42));

  const replayed = sim('replay', file);
  expect(replayed.status).toBe(0);
  expect(`${replayed.stdout.trimEnd()}\nreplay  replays/seed-42.json\n`).toBe(played.stdout);
});

test('--replay picks the file; --dump on a replay matches --dump on the match', () => {
  const file = join(cwd, 'nested', 'dir', 'seven.json');
  expect(sim('match', '--seed', '7', '--replay', file).status).toBe(0);
  const fromReplay = sim('replay', file, '--dump', '600');
  expect(fromReplay.status).toBe(0);
  expect(fromReplay.stdout).toBe(sim('match', '--seed', '7', '--dump', '600').stdout);
});

test('an invalid replay file fails with the problem and the file, not a stack trace', () => {
  const file = join(cwd, 'bad.json');
  writeFileSync(file, JSON.stringify({ ...emptyReplay(1), version: 9 }));
  const { status, stderr } = sim('replay', file);
  expect(status).toBe(1);
  expect(stderr).toContain(`${file}: Invalid replay`);
  expect(stderr).toContain('→ at version');
  expect(stderr).not.toContain('Usage:');
  expect(stderr).not.toMatch(/\n\s+at /);
});

test('a missing replay file fails cleanly', () => {
  const { status, stderr } = sim('replay', join(cwd, 'nope.json'));
  expect(status).toBe(1);
  expect(stderr).toContain('ENOENT');
  expect(stderr).not.toMatch(/\n\s+at /);
});

test.each([[], ['a.json', 'b.json'], ['a.json', '--wat']])('replay %j is a usage error', (...args) => {
  const { status, stderr } = sim('replay', ...args);
  expect(status).toBe(1);
  expect(stderr).toContain('Usage: pnpm sim');
});
