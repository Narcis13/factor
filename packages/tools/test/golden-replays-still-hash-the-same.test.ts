import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveReplay } from '@factor/content';
import { hashState } from '@factor/sim';
import { expect, test } from 'vitest';
import {
  botReplay,
  checkGoldens,
  GOLDEN_EVERY,
  GOLDEN_HASHES_FILE,
  goldenHashes,
  playReplay,
  readGoldenHashes,
  readGoldens,
  updateGoldens,
} from '../src/index.ts';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const GOLDENS = fileURLToPath(new URL('../../../goldens', import.meta.url));

function sim(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

/** A copy of the real goldens to tamper with. */
function copyGoldens(): string {
  const dir = mkdtempSync(join(tmpdir(), 'factor-goldens-'));
  for (const file of readdirSync(GOLDENS)) {
    copyFileSync(join(GOLDENS, file), join(dir, file));
  }
  return dir;
}

test('every golden replay still plays to its stored hashes', () => {
  const checks = checkGoldens(GOLDENS);
  expect(checks.map((check) => check.name)).toEqual(['seed-0', 'seed-101', 'seed-27', 'seed-42', 'seed-54']);
  for (const check of checks) {
    expect(check, check.name).toMatchObject({ problem: null });
  }
});

test('the goldens cover regulation wins for each side, overtime, a Keep kill and a draw', () => {
  const ends = Object.fromEntries(readGoldens(GOLDENS).map(({ name, replay }) => [name, playReplay(replay)]));
  expect(ends['seed-0']).toMatchObject({ tick: 3600, result: { winner: 0 } });
  expect(ends['seed-42']).toMatchObject({ tick: 3600, result: { winner: 1 } });
  expect(ends['seed-27']?.tick).toBeGreaterThan(3600);
  expect(ends['seed-27']?.result).toEqual({ winner: 1 });
  expect(ends['seed-101']?.towers.some((tower) => tower.kind === 'keep' && tower.hp === 0)).toBe(true);
  expect(ends['seed-54']).toMatchObject({ tick: 6000, result: { winner: null } });
});

test('hashes are stored every checkpoint and at the end, and the last is the match’s final hash', () => {
  const replay = botReplay(101);
  const hashes = goldenHashes(replay);
  const final = playReplay(replay);
  const ticks = Object.keys(hashes).map(Number);
  expect(ticks).toEqual([...Array.from({ length: Math.floor(final.tick / GOLDEN_EVERY) }, (_, i) => (i + 1) * GOLDEN_EVERY), final.tick]);
  expect(hashes[String(final.tick)]).toBe(hashState(final));
  expect(hashes[String(GOLDEN_EVERY)]).toBe(hashState(playReplay(replay, GOLDEN_EVERY)));
  expect(readGoldenHashes(GOLDENS)['seed-42']?.['3600']).toBe('5d516ada');
});

test('a changed hash fails at its checkpoint and names the tick', () => {
  const dir = copyGoldens();
  const hashes = readGoldenHashes(dir);
  const seed42 = hashes['seed-42'] ?? {};
  seed42['1200'] = '00000000';
  writeFileSync(join(dir, GOLDEN_HASHES_FILE), JSON.stringify(hashes));
  const failed = checkGoldens(dir).filter((check) => check.problem !== null);
  expect(failed).toEqual([
    { name: 'seed-42', checkpoints: 18, lastTick: 3600, problem: `tick 1200: expected 00000000, got ${String(readGoldenHashes(GOLDENS)['seed-42']?.['1200'])}` },
  ]);

  // Checkpoints compare in tick order, not text order ("1200" < "400").
  seed42['400'] = '11111111';
  writeFileSync(join(dir, GOLDEN_HASHES_FILE), JSON.stringify(hashes));
  expect(checkGoldens(dir).find((check) => check.name === 'seed-42')?.problem).toMatch(/^tick 400: expected 11111111, got /);
});

test('a match that now ends at another tick fails at the first checkpoint it misses', () => {
  const dir = copyGoldens();
  const hashes = readGoldenHashes(dir);
  hashes['seed-0'] = { ...hashes['seed-0'], '3800': 'abcdef01' };
  writeFileSync(join(dir, GOLDEN_HASHES_FILE), JSON.stringify(hashes));
  expect(checkGoldens(dir).find((check) => check.name === 'seed-0')?.problem).toBe('tick 3800: expected abcdef01, got no checkpoint');
});

test('a replay with no stored hashes, hashes with no replay, and a replay that no longer plays all fail', () => {
  const dir = copyGoldens();
  writeFileSync(join(dir, 'seed-9.json'), saveReplay(botReplay(9)));
  rmSync(join(dir, 'seed-27.json'));
  const extra = { tick: 3700, side: 0 as const, handSlot: 0, x: 0, y: 0 };
  writeFileSync(join(dir, 'seed-42.json'), saveReplay({ ...botReplay(42), commands: [...botReplay(42).commands, extra] }));
  const problems = Object.fromEntries(checkGoldens(dir).map((check) => [check.name, check.problem]));
  expect(problems['seed-9']).toBe('no stored hashes in hashes.json');
  expect(problems['seed-27']).toBe('stored hashes but no replay');
  expect(problems['seed-42']).toBe('The match ended at tick 3600 with 1 commands unplayed');
});

test('--update stores fresh hashes for every replay and drops hashes with no replay', () => {
  const dir = copyGoldens();
  writeFileSync(join(dir, 'seed-9.json'), saveReplay(botReplay(9)));
  rmSync(join(dir, 'seed-27.json'));
  writeFileSync(join(dir, GOLDEN_HASHES_FILE), '{}');
  expect(updateGoldens(dir).every((check) => check.problem === null)).toBe(true);
  const hashes = readGoldenHashes(dir);
  expect(Object.keys(hashes)).toEqual(['seed-0', 'seed-101', 'seed-42', 'seed-54', 'seed-9']);
  expect(hashes['seed-9']).toEqual(goldenHashes(botReplay(9)));
  expect(hashes['seed-42']).toEqual(readGoldenHashes(GOLDENS)['seed-42']);
  expect(readFileSync(join(dir, GOLDEN_HASHES_FILE), 'utf8')).toBe(readFileSync(join(dir, GOLDEN_HASHES_FILE), 'utf8').trimEnd() + '\n');
});

test('goldens prints one line per golden and exits 0 when all match', () => {
  const { status, stdout } = sim('goldens', '--dir', GOLDENS);
  expect(status).toBe(0);
  expect(stdout).toContain('seed-42   ok      18 checkpoints to tick 3600');
  expect(stdout.trimEnd().split('\n')).toHaveLength(5);
});

test('goldens exits 1 and names the tick when a golden changed; --update fixes it', () => {
  const dir = copyGoldens();
  const hashes = readGoldenHashes(dir);
  hashes['seed-54'] = { ...hashes['seed-54'], '200': 'ffffffff' };
  writeFileSync(join(dir, GOLDEN_HASHES_FILE), JSON.stringify(hashes));
  const failed = sim('goldens', '--dir', dir);
  expect(failed.status).toBe(1);
  expect(failed.stdout).toMatch(/^seed-54 {3}FAIL {4}tick 200: expected ffffffff, got [0-9a-f]{8}$/m);
  const updated = sim('goldens', '--dir', dir, '--update');
  expect(updated.status).toBe(0);
  expect(updated.stdout).toContain('seed-54   stored  30 checkpoints to tick 6000');
  expect(readGoldenHashes(dir)).toEqual(readGoldenHashes(GOLDENS));
});

test('goldens on a directory with no goldens is bad input, not a crash', () => {
  const { status, stderr } = sim('goldens', '--dir', join(tmpdir(), 'factor-no-such-goldens'));
  expect(status).toBe(1);
  expect(stderr).toContain('no such file or directory');
});
