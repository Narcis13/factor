import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import { emptyReplay, formatClock, playReplay } from '../src/index.ts';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

// Matches save replays relative to the working directory, so keep them out of the repo.
const cwd = mkdtempSync(join(tmpdir(), 'factor-match-'));

function sim(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd });
}

test('an empty match runs through overtime and prints a draw', () => {
  const { status, stdout } = sim('match', '--seed', '42');
  expect(status).toBe(0);
  expect(stdout).toContain('result  draw');
  expect(stdout).toContain('ended   tick 6000 (5:00, overtime)');
  expect(stdout).toContain('stars   0-0');
  expect(stdout).toMatch(/hash {4}[0-9a-f]{8}/);
});

test('the same seed prints the same final hash in separate processes; another seed does not', () => {
  const first = sim('match', '--seed', '7').stdout;
  expect(sim('match', '--seed', '7').stdout).toBe(first);
  expect(sim('match', '--seed', '8').stdout).not.toBe(first);
});

test('--dump prints the state at that tick as JSON', () => {
  const { status, stdout } = sim('match', '--seed', '42', '--dump', '600');
  expect(status).toBe(0);
  const state = JSON.parse(stdout) as SimState;
  expect(state.tick).toBe(600);
  expect(state.result).toBeNull();
  expect(state).toEqual(playReplay(emptyReplay(42), 600));
});

test('--dump past the end of the match fails', () => {
  const { status, stderr } = sim('match', '--seed', '42', '--dump', '6001');
  expect(status).toBe(1);
  expect(stderr).toContain('The match ended at tick 6000, before tick 6001');
});

test.each([[], ['--seed', 'abc'], ['--seed', '4294967296'], ['--seed', '1', '--dump', '1.5'], ['--seed', '1', '--wat']])(
  'match %j is a usage error',
  (...args) => {
    const { status, stderr } = sim('match', ...args);
    expect(status).toBe(1);
    expect(stderr).toContain('Usage: pnpm sim');
  },
);

test('match time prints as m:ss', () => {
  expect(formatClock(0)).toBe('0:00');
  expect(formatClock(1199)).toBe('0:59');
  expect(formatClock(3600)).toBe('3:00');
  expect(formatClock(6000)).toBe('5:00');
});
